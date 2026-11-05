/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Use case: busca as invoices em aberto do cliente e marca quais
 * documentos complementares estão disponíveis.
 *
 * Regra atual (simplificada): os 3 badges = "invoice tem linha de item".
 * O getGroupPlan real do ATA-106/COFC só roda no envio, uma invoice por vez,
 * pra não estourar cota na listagem.
 * TODO — CONFIRMAR regra de negócio real de "Available".
 */
define(['../service/pd-sie-invoice.service'], function (invoiceService) {

    function execute(body) {
        if (!body.customerId) {
            throw new Error('Customer não informado.');
        }

        var invoices = invoiceService.searchOpenInvoices(body.customerId);
        var lineCountMap = invoiceService.getLineCountMap(invoices.map(function (r) { return r.id; }));

        return invoices.map(function (r) {
            var hasLines = !!lineCountMap[r.id];
            return {
                id: r.id,
                tranid: r.tranid,
                trandate: r.trandate,
                duedate: r.duedate,
                amount: r.amount,
                status: r.status,
                hasAta106: hasLines,
                hasCoc: hasLines,
                hasPackingList: hasLines
            };
        });
    }

    return { execute: execute };
});
