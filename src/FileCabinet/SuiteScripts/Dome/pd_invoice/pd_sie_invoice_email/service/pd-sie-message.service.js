/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Service: Communication History (search de 'message').
 * TODO — CONFIRMAR coluna de data e join com a invoice (hoje vêm vazios).
 */
define(['N/search', 'N/log'], function (search, log) {

    var MAX_ROWS = 100;

    function loadHistory(customerId) {
        if (!customerId) return [];

        try {
            var results = [];
            search.create({
                type: 'message',
                filters: [['transaction.entity', 'anyof', customerId]],
                columns: [
                    search.createColumn({ name: 'internalid', sort: search.Sort.DESC }),
                    'subject'
                ]
            }).run().each(function (result) {
                results.push({
                    date: '',
                    subject: result.getValue({ name: 'subject' }) || '(sem assunto)',
                    tranid: ''
                });
                return results.length < MAX_ROWS;
            });
            return results;
        } catch (e) {
            log.error({ title: 'pd_sie - erro ao carregar histórico', details: e.message + '\n' + e.stack });
            return []; // fail-safe: não derruba a tela
        }
    }

    return { loadHistory: loadHistory };
});
