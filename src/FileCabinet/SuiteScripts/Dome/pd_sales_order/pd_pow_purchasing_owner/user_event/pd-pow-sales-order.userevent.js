/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/log',

    '../service/pd-pow-sales-order.service',

    '/SuiteScripts/projectdome/pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
    '/SuiteScripts/projectdome/pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

    '/SuiteScripts/projectdome/pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
], function (
    log,

    sales_order_service,

    search_util,
    record_util
) {

    function afterSubmit(context) {
        try {
            const UE = context.UserEventType;
            const type = context.type;

            if (type !== UE.CREATE && type !== UE.EDIT) return;

            const newRecord = context.newRecord;
            const salesOrderId = newRecord.id;

            sales_order_service.assignBuyerToSO(salesOrderId);

        } catch (error) {
            log.error({
                title: 'Erro no afterSubmit',
                details: error
            });
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});