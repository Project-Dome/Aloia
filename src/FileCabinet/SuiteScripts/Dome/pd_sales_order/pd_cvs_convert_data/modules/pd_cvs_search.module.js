/**
 * @NApiVersion 2.1
 */
define([
        "N/query"
    ],
    
    (query) => {

        const handler = {}

        handler.getSalesConversion = (itemId, salesUOM) => {

            return query.runSuiteQL({
                query: (`SELECT custrecord_aae_mcr_measurement_conversio
                         FROM customrecord_aae_measurement_conversion
                         WHERE custrecord_aae_mcr_item = ${itemId}
                           AND custrecord_aae_mcr_sec_unit = '${salesUOM}'`)
            }).asMappedResults()[0]?.custrecord_aae_mcr_measurement_conversio;

        }

        return handler;

    });
