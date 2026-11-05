/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Use case: envia um e-mail por invoice selecionada, com Invoice +
 * Packing List + ATA-106/COFC (um PDF por grupo vendor+status) anexados.
 * Falha em uma invoice não interrompe as outras.
 */
define(
    [
        'N/log',
        '../service/pd-sie-customer.service',
        '../service/pd-sie-invoice.service',
        '../service/pd-sie-attachment.service',
        '../service/pd-sie-email.service',
        '../modules/pd-sie-email-template.module'
    ],
    function (log, customerService, invoiceService, attachmentService, emailService, emailTemplate) {

        function execute(body) {
            var customerId = body.customerId;
            var invoiceIds = body.invoiceIds || [];

            var overrideEmail = emailService.getOverrideEmail();
            var customerEmail = customerService.getInvoiceEmail(customerId);

            if (!overrideEmail && !customerEmail) {
                throw new Error('Cliente não possui o campo Customer Invoice Email preenchido.');
            }

            var recipient = overrideEmail || customerEmail;
            var sent = [];
            var failed = [];

            invoiceIds.forEach(function (invoiceId) {
                try {
                    var subject = emailTemplate.buildSubject(1);
                    if (overrideEmail) {
                        subject = emailTemplate.buildTestSubject(customerEmail, subject);
                    }

                    emailService.send({
                        recipient: recipient,
                        subject: subject,
                        body: emailTemplate.buildBody(1),
                        attachments: attachmentService.buildAttachments(invoiceId),
                        invoiceId: invoiceId
                    });

                    sent.push(invoiceId);
                } catch (e) {
                    log.error({ title: 'pd_sie - falha no envio da invoice ' + invoiceId, details: e.message });
                    failed.push({ invoiceId: invoiceId, tranid: invoiceService.getTranId(invoiceId), error: e.message });
                }
            });

            return { sent: sent, failed: failed };
        }

        return { execute: execute };
    }
);
