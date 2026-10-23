/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Dome
 * @description Model for the native Return Authorization record (returnauthorization).
 * Covers only the fields consumed by this project (EP1/EP2/EP3) - see TECH-SPEC.
 */
define([
    'N/log',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util',
], function (log, record_util) {

    var TYPE = 'returnauthorization';

    var FIELDS = {
        tranId:      { name: 'tranid' },
        customer:    { name: 'entity', type: 'select' },
        poCustomer:  { name: 'otherrefnum' },
        salesRep:    { name: 'salesrep', type: 'select' },
        location:    { name: 'location', type: 'select' },
        createdFrom: { name: 'createdfrom', type: 'select' },
    };

    var ITEM_SUBLIST_ID = 'item';

    // custcol_pd_partnumbercustomer: existencia na linha de item do RMA ainda nao confirmada
    // contra a conta real - pendencia explicita do TECH-SPEC (secao 3).
    var ITEM_SUBLIST_FIELDS = {
        partNumberCustomer: { name: 'custcol_pd_partnumbercustomer' },
    };

    /**
     * Reads header + item-line data straight from an already-loaded/context record
     * (e.g. context.newRecord in a beforeLoad UserEvent) - does not call record.load().
     * @param {Record} rec
     * @returns {{tranId, customer, poCustomer, salesRep, location, createdFrom, items: Array}}
     */
    function readData(rec) {
        return record_util
            .handler(rec)
            .data({
                fields: FIELDS,
                sublists: {
                    items: {
                        id: ITEM_SUBLIST_ID,
                        fields: ITEM_SUBLIST_FIELDS,
                    },
                },
            });
    }

    return {
        TYPE: TYPE,
        FIELDS: FIELDS,
        readData: readData,
    };
});