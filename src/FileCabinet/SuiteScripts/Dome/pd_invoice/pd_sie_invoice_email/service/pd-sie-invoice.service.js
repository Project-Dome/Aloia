/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Service: consultas de Invoice (SuiteQL).
 */
define(['N/query', '../../../libs/contents'], function (query, contents) {

    var INVOICE_TYPE = contents.TRANSACTION.TYPES.INVOICE;
    var PAID_IN_FULL = contents.TRANSACTION.STATUS.PAID_IN_FULL;

    function searchOpenInvoices(customerId) {
        var sql =
            'SELECT id, tranid, TO_CHAR(trandate, \'MM/DD/YYYY\') AS trandate, ' +
            'TO_CHAR(duedate, \'MM/DD/YYYY\') AS duedate, ' +
            'foreigntotal AS amount, ' +
            'CASE WHEN duedate < SYSDATE AND status != ? THEN \'Overdue\' ' +
            '     WHEN status = ? THEN \'Paid\' ELSE \'Open\' END AS status ' +
            'FROM transaction ' +
            'WHERE type = ? AND entity = ? AND status != ? ' +
            'ORDER BY trandate DESC';

        return query.runSuiteQL({
            query: sql,
            params: [PAID_IN_FULL, PAID_IN_FULL, INVOICE_TYPE, customerId, PAID_IN_FULL]
        }).asMappedResults();
    }

    /** @returns {Object} { invoiceId: true } para invoices com linha de item */
    function getLineCountMap(invoiceIds) {
        var map = {};
        if (!invoiceIds.length) return map;

        var placeholders = invoiceIds.map(function () { return '?'; }).join(',');
        var sql =
            'SELECT transaction, COUNT(*) AS cnt FROM transactionline ' +
            'WHERE transaction IN (' + placeholders + ') AND mainline = \'F\' ' +
            'GROUP BY transaction';

        query.runSuiteQL({ query: sql, params: invoiceIds }).asMappedResults().forEach(function (row) {
            map[row.transaction] = parseInt(row.cnt, 10) > 0;
        });
        return map;
    }

    function hasItemLines(invoiceId) {
        try {
            return !!getLineCountMap([invoiceId])[invoiceId];
        } catch (e) {
            return false; // fail-safe
        }
    }

    function getTranId(invoiceId) {
        try {
            var r = query.runSuiteQL({
                query: 'SELECT tranid FROM transaction WHERE id = ?',
                params: [invoiceId]
            }).asMappedResults();
            return r.length ? r[0].tranid : invoiceId;
        } catch (e) {
            return invoiceId;
        }
    }

    return {
        searchOpenInvoices: searchOpenInvoices,
        getLineCountMap: getLineCountMap,
        hasItemLines: hasItemLines,
        getTranId: getTranId
    };
});
