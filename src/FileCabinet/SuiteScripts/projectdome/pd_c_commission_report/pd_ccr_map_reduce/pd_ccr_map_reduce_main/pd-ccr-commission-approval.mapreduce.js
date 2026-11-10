/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * PD | CCR | Commission Approval MR
 * Project Dome
 *
 * Cria um registro de aprovação de comissão (customrecord_pd_ccr_approval_comission)
 * por invoice paga integralmente (status B) que tenha linhas vinculadas a PO.
 * Único criador dos registros: o UE da invoice fica desligado.
 *
 * Regra de cálculo (por linha da invoice vinculada a PO, valores em moeda base):
 *   custo unitário = (valor das linhas da PO com a mesma referência de linha do SO
 *                     + Freight Allocation dessas linhas) / quantidade dessas linhas
 *   custo          = custo unitário x quantidade faturada
 *   venda          = valor líquido da linha da invoice
 *   lucro          = venda - custo            (pode ser negativo)
 *   comissão       = lucro x % do cliente (custentity_aae_comission_rates)
 *
 * Fallback de custo: se a referência de linha não casar com nenhuma linha da PO,
 * usa as linhas da PO com o mesmo item, desde que exista exatamente uma.
 *
 * Invoices que não passam nas validações NÃO geram registro e são reprocessadas
 * na próxima execução (ex.: vendedor sem fornecedor passa a funcionar sozinho
 * assim que o cadastro for criado). Os motivos ficam no log do summarize.
 */
define(['N/query', 'N/record', 'N/log'], (query, record, log) => {

    const REC = {
        type: 'customrecord_pd_ccr_approval_comission',
        transaction: 'custrecord_pd_ccr_transaction',
        status: 'custrecord_pd_ccr_status',
        vendor: 'custrecord_pd_ccr_vendor_employee',
        percent: 'custrecord_pd_ccr_seller_commission',
        sale: 'custrecord_pd_ccr_sale_value',
        cost: 'custrecord_pd_ccr_po_value',
        profit: 'custrecord_pd_ccr_final_profit',
        amount: 'custrecord_pd_ccr_amount_value'
    };

    const STATUS_PENDING = 3;

    // Trava de sanidade: custo maior que N vezes a venda indica erro de quantidade/UOM.
    const MAX_COST_TO_SALE_RATIO = 10;

    const OUTCOME = {
        CREATED: 'CREATED',
        NOT_PAID: 'SKIP_NOT_PAID',
        NO_SALESREP: 'SKIP_NO_SALESREP',
        NO_VENDOR: 'SKIP_NO_VENDOR',
        MULTI_VENDOR: 'SKIP_MULTI_VENDOR',
        NO_PERCENT: 'SKIP_NO_PERCENT',
        ZERO_PERCENT: 'SKIP_ZERO_PERCENT',
        CREDIT_MEMO: 'SKIP_CREDIT_MEMO',
        NO_LINES: 'SKIP_NO_LINES',
        NO_COST_MATCH: 'SKIP_NO_COST_MATCH',
        SANITY: 'SKIP_SANITY_COST',
        DUPLICATE: 'SKIP_DUPLICATE',
        ERROR: 'ERROR'
    };

    // ---------------------------------------------------------------- input

    const getInputData = () => ({
        type: 'suiteql',
        query: `
            SELECT t.id
            FROM transaction t
            WHERE t.type = 'CustInvc'
              AND t.status = 'B'
              AND EXISTS (
                    SELECT 1 FROM transactionline il
                    WHERE il.transaction = t.id
                      AND il.mainline = 'F'
                      AND il.taxline = 'F'
                      AND il.custcol_aae_purchaseorder IS NOT NULL)
              AND NOT EXISTS (
                    SELECT 1 FROM customrecord_pd_ccr_approval_comission c
                    WHERE c.custrecord_pd_ccr_transaction = t.id)`,
        params: []
    });

    // ------------------------------------------------------------------ map

    const map = (context) => {
        let invoiceId = null;
        try {
            invoiceId = JSON.parse(context.value).values[0];
            const result = processInvoice(invoiceId);
            context.write({ key: result.outcome, value: JSON.stringify({ invoiceId, ...result.detail }) });
        } catch (e) {
            log.error({ title: `Erro na invoice ${invoiceId}`, details: e });
            context.write({ key: OUTCOME.ERROR, value: JSON.stringify({ invoiceId, error: e.message || String(e) }) });
        }
    };

    // ------------------------------------------------------------ summarize

    const summarize = (summary) => {
        if (summary.inputSummary.error) {
            log.error({ title: 'Erro no getInputData', details: summary.inputSummary.error });
        }
        summary.mapSummary.errors.iterator().each((key, error) => {
            log.error({ title: `Erro não tratado no map (${key})`, details: error });
            return true;
        });

        const byOutcome = {};
        summary.output.iterator().each((key, value) => {
            (byOutcome[key] = byOutcome[key] || []).push(JSON.parse(value));
            return true;
        });

        const counts = Object.keys(byOutcome).reduce((acc, k) => ({ ...acc, [k]: byOutcome[k].length }), {});
        log.audit({ title: 'Resumo da execução', details: counts });

        Object.keys(byOutcome)
            .filter(k => k !== OUTCOME.CREATED && k !== OUTCOME.ZERO_PERCENT)
            .forEach(k => {
                // Detalhe em blocos para não estourar o limite de 3.999 caracteres do log.
                chunk(byOutcome[k], 25).forEach((part, i) => {
                    log.audit({ title: `${k} (${i + 1})`, details: JSON.stringify(part) });
                });
            });

        log.audit({ title: 'Uso', details: { segundos: summary.seconds, unidades: summary.usage, yields: summary.yields } });
    };

    // ----------------------------------------------------------- regra

    function processInvoice(invoiceId) {
        const header = getHeader(invoiceId);
        if (!header) return skip(OUTCOME.NOT_PAID);
        if (header.status !== 'B') return skip(OUTCOME.NOT_PAID, { tranid: header.tranid });

        const base = { tranid: header.tranid };

        if (!header.salesrep) return skip(OUTCOME.NO_SALESREP, base);
        if (!header.vendorid) return skip(OUTCOME.NO_VENDOR, { ...base, salesrep: header.salesrepname });
        if (header.nvendors > 1) return skip(OUTCOME.MULTI_VENDOR, { ...base, salesrep: header.salesrepname });

        const percent = parsePercent(header.pcttext);
        if (!header.pctid || percent === null) return skip(OUTCOME.NO_PERCENT, { ...base, customer: header.customer });
        if (percent === 0) return skip(OUTCOME.ZERO_PERCENT, base);

        if (header.ncreditmemos > 0) return skip(OUTCOME.CREDIT_MEMO, base);

        const lines = getLines(invoiceId);
        if (!lines.length) return skip(OUTCOME.NO_LINES, base);

        let sale = 0;
        let cost = 0;
        const unmatched = [];

        lines.forEach(line => {
            const unitCost = resolveUnitCost(line);
            if (unitCost === null) {
                unmatched.push(line.lineid);
                return;
            }
            sale += toNumber(line.sale);
            cost += unitCost * toNumber(line.qty);
        });

        // Sem custo em alguma linha: não gera comissão parcial.
        if (unmatched.length) return skip(OUTCOME.NO_COST_MATCH, { ...base, lines: unmatched });

        if (sale > 0 && cost > sale * MAX_COST_TO_SALE_RATIO) {
            return skip(OUTCOME.SANITY, { ...base, sale: round2(sale), cost: round2(cost) });
        }

        const profit = sale - cost;
        const commission = profit * percent;

        try {
            const rec = record.create({ type: REC.type });
            rec.setValue({ fieldId: REC.transaction, value: invoiceId });
            rec.setValue({ fieldId: REC.status, value: STATUS_PENDING });
            rec.setValue({ fieldId: REC.vendor, value: header.vendorid });
            rec.setValue({ fieldId: REC.percent, value: header.pctid });
            rec.setValue({ fieldId: REC.sale, value: round2(sale) });
            rec.setValue({ fieldId: REC.cost, value: round2(cost) });
            rec.setValue({ fieldId: REC.profit, value: round2(profit) });
            rec.setValue({ fieldId: REC.amount, value: round2(commission) });
            const recId = rec.save();

            return {
                outcome: OUTCOME.CREATED,
                detail: { ...base, recId, sale: round2(sale), cost: round2(cost), commission: round2(commission) }
            };
        } catch (e) {
            // O UE do registro bloqueia duplicidade (execução concorrente).
            if (e.name === 'DUPLICATE_TRANSACTION') return skip(OUTCOME.DUPLICATE, base);
            throw e;
        }
    }

    function resolveUnitCost(line) {
        if (line.unitcost_ref !== null && line.unitcost_ref !== undefined) return toNumber(line.unitcost_ref);
        if (toNumber(line.n_item) === 1 && line.unitcost_item !== null && line.unitcost_item !== undefined) {
            return toNumber(line.unitcost_item);
        }
        return null;
    }

    // ------------------------------------------------------------ consultas

    function getHeader(invoiceId) {
        const rows = query.runSuiteQL({
            query: `
                SELECT
                    t.tranid,
                    t.status,
                    t.employee AS salesrep,
                    BUILTIN.DF(t.employee) AS salesrepname,
                    BUILTIN.DF(t.entity) AS customer,
                    c.custentity_aae_comission_rates AS pctid,
                    BUILTIN.DF(c.custentity_aae_comission_rates) AS pcttext,
                    (SELECT MIN(v.id) FROM vendor v
                      WHERE v.custentity_pd_aae_employee = t.employee AND v.isinactive = 'F') AS vendorid,
                    (SELECT COUNT(*) FROM vendor v
                      WHERE v.custentity_pd_aae_employee = t.employee AND v.isinactive = 'F') AS nvendors,
                    (SELECT COUNT(*) FROM nexttransactionlinelink l
                       JOIN transaction n ON n.id = l.nextdoc
                      WHERE l.previousdoc = t.id AND n.type = 'CustCred') AS ncreditmemos
                FROM transaction t
                JOIN customer c ON c.id = t.entity
                WHERE t.id = ?`,
            params: [invoiceId]
        }).asMappedResults();

        return rows.length ? rows[0] : null;
    }

    function getLines(invoiceId) {
        return query.runSuiteQL({
            query: `
                SELECT
                    il.id AS lineid,
                    -il.quantity AS qty,
                    -il.netamount AS sale,
                    (SELECT SUM(pl.netamount + NVL(pl.custcol_iss_freight_alloc, 0) * NVL(p.exchangerate, 1))
                            / NULLIF(SUM(pl.quantity), 0)
                       FROM transactionline pl
                       JOIN transaction p ON p.id = pl.transaction
                      WHERE pl.transaction = il.custcol_aae_purchaseorder
                        AND pl.mainline = 'F'
                        AND pl.taxline = 'F'
                        AND pl.custcol_pd_cso_line_reference = il.custcol_pd_cso_line_reference) AS unitcost_ref,
                    (SELECT COUNT(*)
                       FROM transactionline pl
                      WHERE pl.transaction = il.custcol_aae_purchaseorder
                        AND pl.mainline = 'F'
                        AND pl.taxline = 'F'
                        AND pl.item = il.item) AS n_item,
                    (SELECT SUM(pl.netamount + NVL(pl.custcol_iss_freight_alloc, 0) * NVL(p.exchangerate, 1))
                            / NULLIF(SUM(pl.quantity), 0)
                       FROM transactionline pl
                       JOIN transaction p ON p.id = pl.transaction
                      WHERE pl.transaction = il.custcol_aae_purchaseorder
                        AND pl.mainline = 'F'
                        AND pl.taxline = 'F'
                        AND pl.item = il.item) AS unitcost_item
                FROM transactionline il
                WHERE il.transaction = ?
                  AND il.mainline = 'F'
                  AND il.taxline = 'F'
                  AND il.custcol_aae_purchaseorder IS NOT NULL`,
            params: [invoiceId]
        }).asMappedResults();
    }

    // ------------------------------------------------------------ utilitários

    function skip(outcome, detail = {}) {
        return { outcome, detail };
    }

    function parsePercent(text) {
        if (!text) return null;
        const match = String(text).match(/(-?\d+(?:[.,]\d+)?)\s*%/);
        if (!match) return null;
        return parseFloat(match[1].replace(',', '.')) / 100;
    }

    function toNumber(value) {
        const n = parseFloat(value);
        return isNaN(n) ? 0 : n;
    }

    function round2(value) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    function chunk(arr, size) {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
    }

    return { getInputData, map, summarize };
});