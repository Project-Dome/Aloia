/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @description Use case (EP2 POST - TECH-SPEC section 6): cria um novo Inbound Shipment vinculado
 * a um RMA.
 * 1. Carrega o Location do RMA selecionado (regra de negocio 2 - Location herdado: o valor grava
 *    no Inbound Shipment vem sempre do RMA, nunca do campo da tela).
 * 2. Cria o inboundshipment sem linhas de item/PO (InboundShipment.model), repassando tambem os 4
 *    campos nativos opcionais do formulario (Bill Of Lading, Expected Shipping Date, Expected
 *    Delivery Date, Memo - TECH-SPEC secao 6) sem validacao adicional - sao opcionais e o tratamento
 *    de "nao sobrescrever quando vazio" fica a cargo do InboundShipment.model.
 * 3. Cria o vinculo em customrecord_pd_irl_rma_link (RmaLink.model).
 *
 * Guarda defensiva (regra de negocio 1 - RMA unico por Shipment): o GET ja exclui RMAs vinculados
 * da lista de opcoes, mas este use case revalida no momento do POST para cobrir corrida entre
 * dois usuarios enviando o formulario quase ao mesmo tempo.
 */
define([
    'N/log',
    'N/error',
    '../Models/ReturnAuthorization.model',
    '../Models/InboundShipment.model',
    '../Models/RmaLink.model',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js',
], function (log, error, ReturnAuthorizationModel, InboundShipmentModel, RmaLinkModel) {

    function execute(params) {
        var rmaId = params.rmaId;

        if (isNullOrEmpty(rmaId)) {
            log.error({ title: 'CreateInboundShipmentForRma | execute - RMA nao informado', details: params });
            throw error.create({
                name: 'IRL_MISSING_RMA',
                message: 'Selecione um RMA antes de salvar.',
            });
        }

        var existingLinks = RmaLinkModel.getByRma(rmaId);
        if (!isNullOrEmpty(existingLinks)) {
            log.error({ title: 'CreateInboundShipmentForRma | execute - RMA ja vinculado a outro shipment', details: rmaId });
            throw error.create({
                name: 'IRL_RMA_ALREADY_LINKED',
                message: 'Este RMA ja esta vinculado a um Inbound Shipment.',
            });
        }

        var location = ReturnAuthorizationModel.getLocationByRmaId(rmaId);
        var locationId = location && location.id;
        if (isNullOrEmpty(locationId)) {
            log.error({ title: 'CreateInboundShipmentForRma | execute - RMA sem Location', details: rmaId });
            throw error.create({
                name: 'IRL_RMA_WITHOUT_LOCATION',
                message: 'O RMA selecionado nao possui Location definida.',
            });
        }

        var shipmentId = InboundShipmentModel.create({
            locationId: locationId,
            billOfLading: params.billOfLading,
            expectedShippingDate: params.expectedShippingDate,
            expectedDeliveryDate: params.expectedDeliveryDate,
            memo: params.memo,
        });
        RmaLinkModel.create({ rmaId: rmaId, shipmentId: shipmentId });

        log.audit({
            title: 'CreateInboundShipmentForRma | execute - success',
            details: JSON.stringify({ rmaId: rmaId, shipmentId: shipmentId, locationId: locationId }),
        });

        return { shipmentId: shipmentId };
    }

    return { execute: execute };
});
