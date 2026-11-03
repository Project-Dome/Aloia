/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define([
        "N/url",

        "../../modules/pd_pdf_const_module"
    ],

    function (url, cts) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {

        }

        function printCreditMemo(parameters) {

            try {

                const suiteletUrl = url.resolveScript({
                    scriptId: cts.CUSTOM_SCRIPT.SUITELET.PRINT_CREDIT_MEMO.ID,
                    deploymentId: cts.CUSTOM_SCRIPT.SUITELET.PRINT_CREDIT_MEMO.DEPLOY,
                    params: {
                        creditmemoid: parameters
                    }
                });

                window.open(suiteletUrl, "_blank");

            } catch (e) {
                log.error({
                    title: "ERROR IN - printCreditMemo",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        return {
            pageInit: pageInit,
            printCreditMemo: printCreditMemo
        };

    });
