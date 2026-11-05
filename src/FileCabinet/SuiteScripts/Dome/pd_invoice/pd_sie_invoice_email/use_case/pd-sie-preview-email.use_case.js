/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Use case: monta o HTML de preview do e-mail (não envia nada).
 */
define(['../modules/pd-sie-email-template.module'], function (emailTemplate) {

    function execute(body) {
        var invoiceIds = body.invoiceIds || [];
        var subject = emailTemplate.buildSubject(invoiceIds.length);
        var htmlBody = emailTemplate.buildBody(invoiceIds.length);

        return { previewHtml: emailTemplate.buildPreviewHtml(subject, htmlBody) };
    }

    return { execute: execute };
});
