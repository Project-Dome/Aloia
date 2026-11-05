/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Service: envio do e-mail e leitura do override de teste.
 * relatedRecords.transactionId registra o e-mail na aba Communication da Invoice.
 */
define(['N/email', 'N/runtime', '../../../libs/contents'], function (email, runtime, contents) {

    var PARAMS = contents.SCRIPTS.SIE_INVOICE_EMAIL_SL.PARAMS;

    function getOverrideEmail() {
        return runtime.getCurrentScript().getParameter({ name: PARAMS.OVERRIDE_EMAIL }) || '';
    }

    /**
     * @param {Object} options
     * @param {string} options.recipient
     * @param {string} options.subject
     * @param {string} options.body
     * @param {file.File[]} options.attachments
     * @param {number|string} options.invoiceId
     */
    function send(options) {
        email.send({
            author: runtime.getCurrentUser().id,
            recipients: options.recipient,
            subject: options.subject,
            body: options.body,
            attachments: options.attachments,
            relatedRecords: { transactionId: options.invoiceId }
        });
    }

    return {
        getOverrideEmail: getOverrideEmail,
        send: send
    };
});
