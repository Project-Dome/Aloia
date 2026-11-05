/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Module: montagem de assunto/corpo do e-mail de invoices.
 * TODO: trocar por template HTML definitivo (ou Email Template do NetSuite).
 */
define([], function () {

    function buildSubject(invoiceCount) {
        return invoiceCount === 1
            ? 'Invoice disponível para pagamento'
            : invoiceCount + ' invoices disponíveis para pagamento';
    }

    function buildTestSubject(realRecipient, subject) {
        return '[TESTE — destinatário real seria: ' + realRecipient + '] ' + subject;
    }

    function buildBody(invoiceCount) {
        return '<p>Prezado(a),</p>' +
            '<p>Segue(m) em anexo ' + invoiceCount + ' invoice(s) e os documentos ' +
            'complementares disponíveis (ATA-106, Certificate of Conformance e/ou Packing List).</p>' +
            '<p>Atenciosamente,<br/>Aloia Aerospace</p>';
    }

    function buildPreviewHtml(subject, htmlBody) {
        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Preview</title></head><body>' +
            '<div style="font-family:Arial,sans-serif;max-width:640px;margin:20px auto;border:1px solid #ddd;padding:20px;">' +
            '<div style="color:#888;font-size:11px;margin-bottom:8px;">Assunto: ' + subject + '</div>' +
            '<hr/>' + htmlBody + '</div></body></html>';
    }

    return {
        buildSubject: buildSubject,
        buildTestSubject: buildTestSubject,
        buildBody: buildBody,
        buildPreviewHtml: buildPreviewHtml
    };
});
