/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Service: dados de Customer usados pelo envio de invoices.
 */
define(['N/query', 'N/search', '../../../libs/contents'], function (query, search, contents) {

    var INVOICE_EMAIL = contents.CUSTOMER.FIELDS.INVOICE_EMAIL;

    function listActiveCustomers() {
        var sql =
            'SELECT id, entitytitle, ' + INVOICE_EMAIL + ' AS invoiceemail ' +
            'FROM customer ' +
            'WHERE isinactive = \'F\' AND stage = \'CUSTOMER\' ' +
            'ORDER BY entitytitle';

        return query.runSuiteQL({ query: sql }).asMappedResults().map(function (r) {
            return { id: r.id, name: r.entitytitle, email: r.invoiceemail || '' };
        });
    }

    function getInvoiceEmail(customerId) {
        var values = search.lookupFields({
            type: search.Type.CUSTOMER,
            id: customerId,
            columns: [INVOICE_EMAIL]
        });
        return values[INVOICE_EMAIL] || '';
    }

    return {
        listActiveCustomers: listActiveCustomers,
        getInvoiceEmail: getInvoiceEmail
    };
});
