/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
  * Filipe Carvalho - SuiteCode
 */
define(
    [
        'N/record',
        'N/search',
        'N/query',

        '../pd_ccr_service/pd-ccr-invoice.service',
        '../pd_ccr_service/pd-ccr-status-commission-approval.service'
    ],
    function (
        record,
        search,
        query,

        invoice_service,
        status_commission_service
    ) {
        function hasCreditMemoApplied(invoiceId) {
            const _rows = query.runSuiteQL({
                query: `SELECT 1 AS found FROM NextTransactionLink AS ntl
                        INNER JOIN transaction AS cm ON cm.id = ntl.nextdoc
                        WHERE ntl.previousdoc = ? AND cm.recordtype = 'creditmemo'`,
                params: [invoiceId]
            }).asMappedResults();
            return _rows.length > 0;
        }

        function afterSubmit(context) {
            if (context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT &&
                context.type !== context.UserEventType.XEDIT) {
                return;
            }

            var invoice = context.newRecord;
            var amountRemaining = invoice.getValue('amountremaining');
            const invoiceId = invoice.id;

            var _invoiceData = invoice_service.getBy({
                by: 'transactionId',
                transactionId: invoiceId
            })
            log.audit({ title: '_invoiceData', details: _invoiceData.salesValue });

            const isInValidUSDCommission = parseFloat(_invoiceData.commissionTotal) == parseFloat(0)
            if (isInValidUSDCommission) {
                log.error({
                    title: `invoice de id ${invoiceId}`,
                    details: `Does not contain commission`
                })

                return
            }

            // Invoice quitada por credit memo não gera comissão (Política de Comissão, Regra 7)
            if (hasCreditMemoApplied(invoiceId)) {
                log.audit('Invoice closed by credit memo', 'Invoice ID: ' + invoiceId);
                return;
            }

            // Só cria se a fatura estiver totalmente paga
            if (Number(amountRemaining) === 0) {

                var existingSearch = search.create({
                    type: 'customrecord_pd_ccr_approval_comission',
                    filters: [
                        ['custrecord_pd_ccr_transaction', 'is', invoiceId]
                    ],
                    columns: ['internalid']
                });

                var exists = existingSearch.run().getRange({ start: 0, end: 1 });

                if (exists && exists.length > 0) {
                    log.audit('Commission Record Already Exists', 'Invoice ID: ' + invoiceId);
                    return;
                }

                let customRec = record.create({
                    type: 'customrecord_pd_ccr_approval_comission'
                });

                customRec.setValue({
                    fieldId: 'custrecord_pd_ccr_transaction',
                    value: invoiceId
                });

                customRec.setValue({
                    fieldId: 'custrecord_pd_ccr_status',
                    value: status_commission_service.STATUS_COMMISSION.PENDING
                });

                customRec.setValue({
                    fieldId: 'custrecord_pd_ccr_amount_value',
                    value: parseFloat(_invoiceData.commissionTotal)
                });


                customRec.setValue({
                    fieldId: 'custrecord_pd_ccr_po_value',
                    value: _invoiceData.purchaseValue
                });
                customRec.setValue({
                    fieldId: 'custrecord_pd_ccr_sale_value',
                    value: _invoiceData.salesValue
                });
                customRec.setValue({
                    fieldId: 'custrecord_pd_ccr_final_profit',
                    value: _invoiceData.finalProfit
                });
                customRec.setValue({
                    fieldId: 'custrecord_pd_ccr_seller_commission',
                    value: _invoiceData.invoiceData[0].customerCommissionPercent
                });

                const recId = customRec.save();
                log.audit('Commission Record Created', 'Internal ID: ' + recId);
            }
        }

        return {
            afterSubmit: afterSubmit
        };
    }
);
