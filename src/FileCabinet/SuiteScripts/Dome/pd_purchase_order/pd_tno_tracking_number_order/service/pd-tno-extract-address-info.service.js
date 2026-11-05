/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @author Rogério Gonçalves Rodrigues
 */

define([], function () {

    function buildAddressText(address) {
        if (!address) {
            return '';
        }

        var parts = [];
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.state) parts.push(address.state);
        if (address.postal_code) parts.push(address.postal_code);
        if (address.country) parts.push(address.country);

        var text = parts.join(', ');

        var coords = address.coordinates;
        if (coords && (coords.latitude || coords.longitude)) {
            text += (text ? ' ' : '') + '(Lat: ' + (coords.latitude || '') + ', Long: ' + (coords.longitude || '') + ')';
        }

        return text;
    }

    function extractOrigin(shipperAddress) {
        return buildAddressText(shipperAddress);
    }

    function extractFinalDestination(recipientAddress) {
        return buildAddressText(recipientAddress);
    }

    function extractCurrentLocation(latestEvent) {
        if (!latestEvent) {
            return '';
        }

        var lines = [];

        if (latestEvent.location) {
            lines.push(latestEvent.location);
        }

        var addressText = buildAddressText(latestEvent.address);
        if (addressText) {
            lines.push(addressText);
        }

        if (latestEvent.time_iso) {
            var timeIso = String(latestEvent.time_iso);
            var parts = timeIso.split('T');
            var rawDate = parts[0] || '';
            var date = rawDate;

            if (rawDate && rawDate.indexOf('-') > -1) {
                var d = rawDate.split('-');
                if (d.length === 3) {
                    date = d[1] + '/' + d[2] + '/' + d[0];
                }
            }

            var hour = parts[1] ? parts[1].substring(0, 5) : '';
            lines.push(date + ' - ' + hour);
        }

        return lines.join('\n');
    }

    return {
        extractOrigin: extractOrigin,
        extractFinalDestination: extractFinalDestination,
        extractCurrentLocation: extractCurrentLocation
    };
});
