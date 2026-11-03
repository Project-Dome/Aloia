/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define([
        "N/render",
        "N/record",

        "../../layout/pd_pdf_credit_memo_layout_module",
        "../../modules/pd_pdf_credit_memo_utils_module"
    ],

    (render, record, creditMemoLayout, utilsMd) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            try {

                const {
                    response,
                    request
                } = scriptContext;

                const creditMemoRecord = record.load({
                    type: record.Type.CREDIT_MEMO,
                    id: request.parameters.creditmemoid
                });

                const createdFromId = creditMemoRecord.getValue({
                    fieldId: "createdfrom"
                });

                // Detecção binária de origem (confirmada com o usuário): createdfrom do Credit
                // Memo só assume Return Authorization (RMA_SCRAP) ou Invoice (INVOICE_DIRECT).
                const originType = utilsMd.resolveOriginType(createdFromId);

                let returnAuthorizationRecord = null;
                let invoiceFromRmaRecord = null;

                if (originType === utilsMd.ORIGIN_TYPE.RMA_SCRAP) {

                    returnAuthorizationRecord = record.load({
                        type: record.Type.RETURN_AUTHORIZATION,
                        id: createdFromId
                    });

                    const invoiceFromRmaId = returnAuthorizationRecord.getValue({
                        fieldId: "createdfrom"
                    });

                    if (invoiceFromRmaId) {
                        invoiceFromRmaRecord = record.load({
                            type: record.Type.INVOICE,
                            id: invoiceFromRmaId
                        });
                    }

                }

                const params = utilsMd.manipulateCreditMemoPdf(
                    creditMemoRecord,
                    originType,
                    returnAuthorizationRecord,
                    invoiceFromRmaRecord
                );

                const html = creditMemoLayout.getXml(params);

                const renderer = render.create();
                renderer.templateContent = html;

                const pdfFile = renderer.renderAsPdf();

                pdfFile.name = `CM_${params.creditMemoNumber}.pdf`;

                scriptContext.response.writeFile({
                    file: pdfFile,
                    isInline: true
                });


            } catch (e) {
                log.error({
                    title: "ERROR IN - onRequest",
                    details: {
                        stack: e.stack,
                        message: e.message,
                    }
                });
            }

        }

        return {onRequest}

    });
