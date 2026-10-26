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
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js',
], function (log, record_util, search_util) {

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

    /**
     * Returns RMAs selectable for linking to a new Inbound Shipment - i.e. every RMA except the
     * ones already present in `excludedRmaIds` (EP2 - TECH-SPEC section 6, regra de negocio 1:
     * um RMA nao pode ser vinculado a mais de um Inbound Shipment).
     * @param {Array<string>} excludedRmaIds - internal ids of RMAs already linked (see
     * RmaLink.model.getAllLinkedRmaIds).
     * @returns {Array<{id, tranId}>}
     */
    function searchSelectableForShipment(excludedRmaIds) {
        var idField = { name: 'internalid' };

        var query = isNullOrEmpty(excludedRmaIds)
            ? search_util.where(search_util.query(idField, 'isnotempty'))
            : search_util.where(search_util.query(idField, 'noneof', excludedRmaIds));

        return search_util.all({
            type: TYPE,
            columns: { tranId: FIELDS.tranId },
            query: query,
        }) || [];
    }

    /**
     * Returns the location (select {id, name}) of a given RMA, by internal id - used by EP2 to
     * inherit the Location of the selected RMA when creating the Inbound Shipment (TECH-SPEC
     * section 6, regra de negocio 2: Location herdado).
     * @param {string|number} rmaId
     * @returns {{id, name}|null}
     */
    function getLocationByRmaId(rmaId) {
        if (isNullOrEmpty(rmaId)) return null;

        var result = search_util.first({
            type: TYPE,
            columns: { location: FIELDS.location },
            query: search_util.where(
                search_util.query({ name: 'internalid' }, 'is', rmaId)
            ),
        });

        return (result && result.location) || null;
    }

    return {
        TYPE: TYPE,
        FIELDS: FIELDS,
        readData: readData,
        searchSelectableForShipment: searchSelectableForShipment,
        getLocationByRmaId: getLocationByRmaId,
    };
});