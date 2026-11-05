/**
 * @NApiVersion 2.1
 */
define([],
    
    () => {

        const handler = {}

        handler.calculateUnitPrice = (amount, quantityPdf) => {
            return amount / quantityPdf;
        }

        handler.calculateQuantityAloia = (quantityPDF, mcr) => {
            return quantityPDF / mcr;
        }

        handler.calculateUnitPriceAloia = (amount, quantityAloia) => {
            return amount / quantityAloia;
        }

        return handler;

    });
