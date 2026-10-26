/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Dome
 * @description Model for the native Inbound Shipment record (inboundshipment). Covers only the
 * fields consumed by EP2 (TECH-SPEC section 6) - creation of a "container" shipment without
 * item/PO lines, plus 4 optional native fields that mirror the native creation screen (Bill Of
 * Lading, Expected Shipping Date, Expected Delivery Date, Memo).
 *
 * Internal IDs de billOfLading/expectedShippingDate/expectedDeliveryDate (billofladingno,
 * expectedshippingdate, expecteddeliverydate) ainda nao foram confirmados contra a conta real -
 * mesma pendencia explicita do TECH-SPEC secao 3 (ja registrada para outros campos nativos deste
 * projeto, ver ReturnAuthorization.model.js).
 */
define([
    'N/log',
    'N/record',
    'N/format',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js',
], function (log, record, format, record_util) {

    var TYPE = 'inboundshipment';

    var FIELDS = {
        location:             { name: 'location', type: 'select' },
        billOfLading:         { name: 'billofladingno' },
        expectedShippingDate: { name: 'expectedshippingdate', type: 'date' },
        expectedDeliveryDate: { name: 'expecteddeliverydate', type: 'date' },
        memo:                 { name: 'memo' },
    };

    /**
     * Creates a new Inbound Shipment with no item/PO lines - the record nativo normalmente exige
     * ao menos uma linha de item/PO para ser salvo pela tela padrao do NetSuite; aqui ele e criado
     * como "container" sem linhas (TECH-SPEC secao 6, decisao de arquitetura:
     * record.create() + save({ ignoreMandatoryFields: true })).
     *
     * Os 4 campos opcionais (billOfLading, expectedShippingDate, expectedDeliveryDate, memo) so sao
     * incluidos no set quando preenchidos - se o usuario nao informar, o campo simplesmente nao e
     * setado (record_util.set ignora chaves com valor undefined), igual ao comportamento da tela
     * nativa de criacao.
     * @param {{locationId: string|number, billOfLading: string=, expectedShippingDate: string=,
     * expectedDeliveryDate: string=, memo: string=}} data
     * @returns {string} internal id of the created record
     */
    function create(data) {
        var rec = record.create({ type: TYPE });

        var setData = {};
        setData[FIELDS.location.name] = { id: data.locationId };
        setData[FIELDS.billOfLading.name] = isNullOrEmpty(data.billOfLading) ? undefined : data.billOfLading;
        setData[FIELDS.memo.name] = isNullOrEmpty(data.memo) ? undefined : data.memo;
        setData[FIELDS.expectedShippingDate.name] = parseDate(data.expectedShippingDate);
        setData[FIELDS.expectedDeliveryDate.name] = parseDate(data.expectedDeliveryDate);

        var newId = record_util
            .handler(rec)
            .set(setData)
            .save({ ignoreMandatoryFields: true });

        log.audit({
            title: 'InboundShipment.model | create - success',
            details: JSON.stringify({ id: newId, locationId: data.locationId }),
        });
        return newId;
    }

    /**
     * Parses a form date string (DATE field type, user date format) into a JS Date, as required by
     * record.setValue on native date fields. Returns undefined (field not set) when empty or when
     * parsing fails - these fields are optional, so a malformed value is logged and skipped instead
     * of blocking the whole creation.
     * @param {string} dateString
     * @returns {Date|undefined}
     */
    function parseDate(dateString) {
        if (isNullOrEmpty(dateString)) return undefined;

        try {
            return format.parse({ value: dateString, type: format.Type.DATE });
        } catch (e) {
            log.error({
                title: 'InboundShipment.model | parseDate - valor de data invalido, campo ignorado',
                details: { dateString: dateString, error: e },
            });
            return undefined;
        }
    }

    return {
        TYPE: TYPE,
        FIELDS: FIELDS,
        create: create,
    };
});
