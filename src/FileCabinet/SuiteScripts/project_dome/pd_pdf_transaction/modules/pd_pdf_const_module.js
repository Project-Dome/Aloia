/**
 * @NApiVersion 2.1
 */
define([],
    
    () => {

        return {
            SIGNATURE: {
                // Mesma fonte usada no ATA-106 / COFC
                FONT_PATH: "SuiteScripts/projectdome/pd_pdf_ata_106/Fonts/GreatVibes-Regular.ttf",
                COLOR: "#1a44a8"
            },
            CUSTOM_FIELDS: {
                TRANSACTIONS: {
                    BODY_FIELDS: {
                        INVOICE_PDF: "custbody_pd_pdf_invoice_pdf_dc",
                        CREDIT_MEMO_PDF: "custbody_pd_pdf_credit_memo_pdf_dc"
                    }
                },
                RETURN_AUTHORIZATION: {
                    BODY_FIELDS: {
                        RETURN_REASON: "custbody_pd_motivo_rma_scrap"
                    }
                }
            },
            CUSTOM_SCRIPT: {
                SUITELET: {
                    PRINT_INVOICE: {
                        ID: "customscript_pd_pdf_print_invoice_sl",
                        DEPLOY: "customdeploy_pd_pdf_print_invoice_sl"
                    },
                    PRINT_PACK_LIST: {
                        ID: "customscript_pd_pdf_print_pack_list_sl",
                        DEPLOY: "customdeploy_pd_pdf_print_pack_list_sl"
                    },
                    PRINT_CREDIT_MEMO: {
                        ID: "customscript_pd_pdf_print_credit_memo_sl",
                        DEPLOY: "customdeploy_pd_pdf_print_credit_memo_sl"
                    }
                }
            },
            // Parâmetro de deployment do Invoice (customdeploy_pd_pdf_print_invoice_sl),
            // reaproveitado como fonte única de Terms and Conditions pelo Credit Memo - decisão
            // confirmada com o usuário para não duplicar o texto em dois lugares.
            SCRIPT_PARAMETERS: {
                INVOICE_TERMS_CONDITION: "custscript_pd_invoice_terms_condition_ds"
            }
        }

    });