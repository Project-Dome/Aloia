/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @description Constants for the "Inbound Shipments Vinculados" subtab/sublist rendered on the
 * Return Authorization record (EP1 - TECH-SPEC section 5).
 */
define([], function () {

    var SUBTAB = Object.freeze({
        id: 'custpage_irl_inbound_shpmts',
        label: 'Inbound Shipments Vinculados',
    });

    var SUBLIST = Object.freeze({
        id: 'custpage_irl_inbound_shpmts_list',
        label: 'Inbound Shipments Vinculados',
    });

    // Column order follows TECH-SPEC section 5 ("Colunas exibidas e origem do dado").
    var COLUMNS = Object.freeze({
        tranId:      { id: 'custpage_irl_tranid',     label: 'Número do RMA' },
        customer:    { id: 'custpage_irl_customer',   label: 'Customer' },
        poCustomer:  { id: 'custpage_irl_ponumber',   label: 'PO Customer' },
        salesRep:    { id: 'custpage_irl_salesrep',   label: 'SA' },
        partNumber:  { id: 'custpage_irl_pn',         label: 'PN' },
        vendor:      { id: 'custpage_irl_vendor',     label: 'Vendor' },
        location:    { id: 'custpage_irl_location',   label: 'Location' },
        invoice:     { id: 'custpage_irl_invoice',    label: 'Invoice' },
    });

    return {
        SUBTAB: SUBTAB,
        SUBLIST: SUBLIST,
        COLUMNS: COLUMNS,
    };
});