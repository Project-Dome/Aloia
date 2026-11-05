/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Use case: histórico de e-mails (aba Communication) das invoices do cliente.
 */
define(['../service/pd-sie-message.service'], function (messageService) {

    function execute(body) {
        return messageService.loadHistory(body.customerId);
    }

    return { execute: execute };
});
