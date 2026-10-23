/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Dome
 * @description Model for customrecord_pd_irl_rma_link (vinculo RMA x Inbound Shipment).
 * See MANIFEST.md for field internal ids.
 */
define([
    'N/log',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util',
], function (log, search_util) {

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

    return {
        TYPE: TYPE,
        FIELDS: FIELDS,
        getByRma: getByRma,
    };
});