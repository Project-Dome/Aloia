/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @author Project Dome
 *
 * contents.js — IDs de records, campos, listas e scripts usados pelos
 * projetos da pasta Dome/ desta conta (Aloia Aerospace).
 * Ao criar um projeto novo, acrescente os IDs aqui em vez de deixar
 * string solta no código.
 */
define([], function () {

    var CUSTOMER = {
        FIELDS: {
            INVOICE_EMAIL: 'custentity_atlas_customer_invoice_email'
        }
    };

    var TRANSACTION = {
        TYPES: {
            INVOICE: 'CustInvc'
        },
        STATUS: {
            PAID_IN_FULL: 'Paid In Full'
        }
    };

    var SCRIPTS = {
        SIE_INVOICE_EMAIL_SL: {
            SCRIPT_ID: 'customscript_pd_sie_invoice_email_sl',
            DEPLOY_ID: 'customdeploy_pd_sie_invoice_email_sl',
            PARAMS: {
                OVERRIDE_EMAIL: 'custscript_pd_sie_override_email'
            }
        }
    };

    return {
        CUSTOMER: CUSTOMER,
        TRANSACTION: TRANSACTION,
        SCRIPTS: SCRIPTS
    };
});
