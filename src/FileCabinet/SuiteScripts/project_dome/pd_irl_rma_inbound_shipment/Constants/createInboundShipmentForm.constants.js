/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @description Constants for the Suitelet form that creates an Inbound Shipment linked to a RMA
 * (EP2 - TECH-SPEC section 6).
 */
define([], function () {

    var FORM = Object.freeze({
        title: 'Criar Inbound Shipment vinculado a RMA',
        submitLabel: 'Salvar',
    });

    // campo Location: preenchido pelo Client Script (EP3 - TECH-SPEC secao 7) ao selecionar o RMA;
    // o id/label ja fica pronto aqui para o EP3 consumir.
    // Os 4 campos abaixo (billOfLading, expectedShippingDate, expectedDeliveryDate, memo) espelham
    // campos nativos opcionais do inboundshipment (TECH-SPEC secao 6) - sem logica especial, apenas
    // editaveis e repassados direto ao POST.
    var FIELDS = Object.freeze({
        rma:                   { id: 'custpage_irl_rma',                      label: 'RMA' },
        location:               { id: 'custpage_irl_location',                label: 'Location' },
        billOfLading:           { id: 'custpage_irl_bill_of_lading',          label: 'Bill Of Lading' },
        expectedShippingDate:   { id: 'custpage_irl_expected_shipping_date',  label: 'Expected Shipping Date' },
        expectedDeliveryDate:   { id: 'custpage_irl_expected_delivery_date', label: 'Expected Delivery Date' },
        memo:                   { id: 'custpage_irl_memo',                    label: 'Memo' },
    });

    return {
        FORM: FORM,
        FIELDS: FIELDS,
    };
});
