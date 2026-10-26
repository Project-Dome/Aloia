/**
 * @NApiVersion 2.1
 * @ModuleScope public
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [
        'N/log',
        'N/record',
        'N/runtime',
        'N/cache',
        'N/record',
        'N/format',
        'N/query',


        '../../pd_pos_service/pd-pos-commission-approval.service',
        '../../pd_pos_service/pd-pos-status-commission.service',
        '../../pd_pos_service/pd-pos-vendor-bill.service',
    ],
    function (
        log,
        record,
        runtime,
        cache,
        record,
        format,
        query,

        commission_approval_service,
        status_commission_service,
        vendor_bill_service
    ) {
        function getVendorBillByInvoice() {
            const _queryString = buildQuery();

            const _results = query.runSuiteQL({
                query: _queryString
            }).asMappedResults();

            log.audit({ title: '_results', details: _results });

            return _results.length > 0 ? _results : null;

            function buildQuery() {
                const _queryString = [
                    `SELECT
                        MAX(tl.netamount * -1) as invoiceAmount,
                        MAX(ABS(tl.quantity)) as invoiceQty,
                        MAX(e.custentity_aae_comission_rates) as commissionRate,
                        tl.custcol_aae_purchaseorder as purchaseOrderId,
                        transaction.id as invoiceId,
                        vendorBillLine.transaction as vendorBillId,
                        tl.custcol_aae_buyer_purchase_order as buyer,
                        tl.custcol_pd_cso_line_reference as lineReference
                    FROM
                        transaction
                        INNER JOIN transactionline as tl ON tl.transaction = transaction.id
                        AND mainline = 'F'
                        AND taxline = 'F'
                        AND tl.custcol_aae_purchaseorder IS NOT NULL
                        INNER JOIN employee as e on e.id = tl.custcol_aae_buyer_purchase_order
                        INNER JOIN transactionline as vendorBillLine ON vendorBillLine.createdfrom = tl.custcol_aae_purchaseorder
                        AND vendorBillLine.mainline = 'F'
                        AND vendorBillLine.taxline = 'F'
                        AND vendorBillLine.custcol_pd_cso_line_reference = tl.custcol_pd_cso_line_reference
                        INNER JOIN transaction as vendorbill on vendorbill.id = vendorBillLine.transaction
                        AND vendorbill.recordtype = 'vendorbill'
                        LEFT JOIN customrecord_pd_pos_approval_saving AS aps ON aps.custrecord_pd_pos_pas_invoice = transaction.id
                        AND aps.custrecord_pd_pos_pas_line_reference = tl.custcol_pd_cso_line_reference
                    WHERE
                        transaction.status IN ('B', 'CustInvc:B')
                        AND NOT EXISTS (
                            SELECT 1 FROM NextTransactionLink AS ntl
                            INNER JOIN transaction AS cm ON cm.id = ntl.nextdoc
                            WHERE ntl.previousdoc = transaction.id AND cm.recordtype = 'creditmemo'
                        )
                        AND transaction.recordtype = 'invoice'
                        AND aps.id IS NULL
                    GROUP BY
                        tl.custcol_aae_purchaseorder,
                        transaction.id,
                        vendorBillLine.transaction,
                        tl.custcol_aae_buyer_purchase_order,
                        tl.custcol_pd_cso_line_reference`
                ].join(' ');

                return _queryString;
            }
        }

        function getInputData() {
            try {
                return getVendorBillByInvoice();
            } catch (error) {
                log.error({ title: 'error', details: error });
            }
        }

        function map(context) {
            try {
                const _optionsData = JSON.parse(context.value);
                log.audit({ title: 'Key', details: `${_optionsData.invoiceid}&&${_optionsData.buyer}` });

                context.write({
                    key: `${_optionsData.invoiceid}&&${_optionsData.vendorbillid}&&${_optionsData.linereference}`,
                    value: _optionsData
                });
            } catch (exception) {
                log.error('Exceptions map', exception);
            };
        };

        // Uma execução por invoice x Vendor Bill x linha. Saving proporcional à quantidade vendida
        // (Política de Saving, Regra 5), limitado ao que ainda resta da linha da Vendor Bill.
        function reduce(context) {
            try {
                const data = JSON.parse(context.values[0]);
                log.audit({ title: 'Data reduce', details: data });

                const line = (vendor_bill_service.getLinesByTransactionIds(data.vendorbillid) || [])
                    .find(l => l.buyer == data.buyer && l.lineReference == data.linereference);

                if (!line) {
                    log.audit({ title: 'Vendor bill line not found', details: data });
                    return;
                }

                const used = query.runSuiteQL({
                    query: `SELECT NVL(SUM(custrecord_pd_pos_pas_quantity), 0) AS used
                            FROM customrecord_pd_pos_approval_saving
                            WHERE custrecord_pd_pos_pas_transaction = ?
                            AND custrecord_pd_pos_pas_line_reference = ?`,
                    params: [data.vendorbillid, data.linereference]
                }).asMappedResults()[0].used;

                const available = parseFloat(line.baseQuantity || 0) - parseFloat(used || 0);
                const qty = Math.min(parseFloat(data.invoiceqty || 0), available);

                if (!(qty > 0)) {
                    log.audit({ title: 'Vendor bill line fully consumed', details: { data: data, used: used } });
                    return;
                }

                const saving = parseFloat(line.savingPerBaseUnit || 0) * qty;
                const commission = saving > 0 ? saving * 0.10 : 0; // Regras 2 e 4: 10% fixo, negativo vira zero
                const purchaseValue = parseFloat(line.purchasePerBaseUnit || 0) * qty;
                const saleValue = parseFloat(data.invoiceamount || 0);

                const approvalCommissionRecord = commission_approval_service.create();
                commission_approval_service.set({
                    record: approvalCommissionRecord,
                    data: {
                        transaction: data.vendorbillid,
                        invoice: data.invoiceid,
                        lineReference: data.linereference,
                        quantity: qty,
                        status: commission > 0 ? status_commission_service.STATUS_COMMISSION.PENDING : status_commission_service.STATUS_COMMISSION.APPROVED,
                        amountValue: commission,
                        buyer: data.buyer,
                        saleValue: saleValue,
                        purchaseValue: purchaseValue,
                        finalProfit: saleValue - purchaseValue,
                        buyerCommission: data.commissionrate
                    }
                });
                commission_approval_service.save(approvalCommissionRecord);
            } catch (e) {
                log.error('Exceptions reduce', e);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        }
    }
);
