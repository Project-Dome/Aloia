/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Dome
 * @description Model for customrecord_pd_irl_rma_link (vinculo RMA x Inbound Shipment).
 * See MANIFEST.md for field internal ids.
 */
define([
    'N/log',
    'N/record',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js',
], function (log, record, record_util, search_util) {

    var TYPE = 'customrecord_pd_irl_rma_link';

    var FIELDS = {
        internalId: { name: 'internalid' },
        rma:        { name: 'custrecord_pd_irl_rma', type: 'select' },
        shipment:   { name: 'custrecord_pd_irl_shipment', type: 'select' },
    };

    /**
     * Returns every link record for a given Return Authorization.
     * @param {string|number} rmaId
     * @returns {Array<{internalId, rma, shipment}>}
     */
    function getByRma(rmaId) {
        if (isNullOrEmpty(rmaId)) return [];

        return search_util.all({
            type: TYPE,
            columns: FIELDS,
            query: search_util.where(
                search_util.query(FIELDS.rma, 'anyof', rmaId)
            ),
        }) || [];
    }

    /**
     * Returns the internal ids of every RMA that already has a link registered - used by EP2
     * (TECH-SPEC section 6, regra de negocio 1) to exclude already-linked RMAs from the Suitelet's
     * RMA field options.
     * @returns {Array<string>}
     */
    function getAllLinkedRmaIds() {
        var links = search_util.all({
            type: TYPE,
            columns: { rma: FIELDS.rma },
            query: search_util.where(
                search_util.query(FIELDS.rma, 'isnotempty')
            ),
        }) || [];

        return links
            .map(function (link) { return link.rma && link.rma.id; })
            .filter(function (id) { return !isNullOrEmpty(id); });
    }

    /**
     * Creates a new link between a Return Authorization and an Inbound Shipment (EP2 - TECH-SPEC
     * section 6, passo 2).
     * @param {{rmaId: string|number, shipmentId: string|number}} data
     * @returns {string} internal id of the created link record
     */
    function create(data) {
        var rec = record.create({ type: TYPE });

        var setData = {};
        setData[FIELDS.rma.name] = { id: data.rmaId };
        setData[FIELDS.shipment.name] = { id: data.shipmentId };

        var newId = record_util
            .handler(rec)
            .set(setData)
            .save();

        log.audit({
            title: 'RmaLink.model | create - success',
            details: JSON.stringify({ id: newId, rmaId: data.rmaId, shipmentId: data.shipmentId }),
        });
        return newId;
    }

    return {
        TYPE: TYPE,
        FIELDS: FIELDS,
        getByRma: getByRma,
        getAllLinkedRmaIds: getAllLinkedRmaIds,
        create: create,
    };
});