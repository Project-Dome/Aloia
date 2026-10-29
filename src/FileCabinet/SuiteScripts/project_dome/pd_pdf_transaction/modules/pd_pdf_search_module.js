/**
 * @NApiVersion 2.1
 */
define([
        "N/search",
        "N/query"
    ],
    (search, query) => {
        const handler = {}

        const SYSTEM_NOTE_TYPE_CREATE = "1";
        const NAME_PARTICLES = ["da", "de", "do", "das", "dos", "e", "di", "du", "del", "van", "von"];

        /**
         * Criador real da transação via SystemNote (evento "Create").
         * custbody_created_by / createdby são herdados no Transform (Estimate -> SO -> Invoice),
         * por isso não servem. RecordTypeID = -30 restringe a transações (RecordID não é único
         * entre tipos de registro). BUILTIN.DF evita depender de permissão no Employee.
         */
        handler.getRecordCreator = (recordId) => {
            if (!recordId) return null;
            try {
                const results = query.runSuiteQL({
                    query: "SELECT SystemNote.Name AS employeeid, BUILTIN.DF(SystemNote.Name) AS creatorname, " +
                        "SystemNote.Type AS notetype, SystemNote.Date AS notedate FROM SystemNote " +
                        "WHERE SystemNote.RecordID = ? AND SystemNote.RecordTypeID = -30 " +
                        "ORDER BY SystemNote.Date ASC",
                    params: [recordId]
                }).asMappedResults();

                if (!results || !results.length) return null;

                // Fallback: sem linha "Create" explícita — usa a nota mais antiga.
                const chosen = results.find(r => String(r.notetype) === SYSTEM_NOTE_TYPE_CREATE) || results[0];

                const creator = {id: chosen.employeeid, displayName: chosen.creatorname || ""};
                log.debug({title: "SystemNote Chosen Creator", details: {recordId, creator}});
                return creator;
            } catch (e) {
                log.error({title: "ERROR IN - getRecordCreator", details: {recordId, message: e.message}});
                return null;
            }
        }

        // "Nome + último sobrenome", ignorando partículas (da, de, dos...).
        const formatSignatureName = (first, last, fallback) => {
            const clean = (s) => String(s || "").replace(/\s+/g, " ").trim().split(" ")
                .filter(p => p && NAME_PARTICLES.indexOf(p.toLowerCase()) === -1);
            let firstParts = clean(first);
            let lastParts = clean(last);
            if (!firstParts.length) {
                const all = clean(fallback);
                firstParts = all.slice(0, 1);
                lastParts = all.slice(1);
            }
            const out = [];
            if (firstParts.length) out.push(firstParts[0]);
            if (lastParts.length) out.push(lastParts[lastParts.length - 1]);
            return out.join(" ");
        }

        /**
         * Nome completo (Prepared By) + nome de assinatura do funcionário.
         * Se a role não tiver permissão no Employee, usa o nome de exibição do SystemNote.
         */
        handler.getSignerData = (employeeId, fallbackDisplayName) => {
            let first = "", last = "", display = fallbackDisplayName || "";
            if (employeeId) {
                try {
                    const r = query.runSuiteQL({
                        query: "SELECT firstname, lastname, entityid FROM employee WHERE id = ?",
                        params: [employeeId]
                    }).asMappedResults()[0];
                    if (r) {
                        first = r.firstname || "";
                        last = r.lastname || "";
                        display = r.entityid || display;
                    }
                } catch (e) {
                    log.audit({title: "getSignerData - usando fallback do SystemNote", details: e.message});
                }
            }
            const result = {
                fullName: display,
                signatureName: formatSignatureName(first, last, display)
            };
            log.debug({title: "getSignerData RESULT", details: {employeeId, result}});
            return result;
        }

        handler.getCustomerLookup = (customerId) => {
            if (!customerId) return null;
            const customerLookup = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: [
                    "entitynumber"
                ]
            });
            return {
                entitynumber: customerLookup["entitynumber"]
            }
        }

        // REPLACED: now fetches lot dates from the lot record directly
        handler.getInventoryDetaiLookup = (inventoryDetailId) => {
            if (!inventoryDetailId) return null;
            const inventoryDetailLookup = search.lookupFields({
                type: search.Type.INVENTORY_NUMBER,
                id: inventoryDetailId,
                columns: [
                    "inventorynumber",
                    "expirationdate",
                    "custitemnumber_aln_manufactured_date",
                    "custitemnumber_aae_manufacturerdetail",
                    "custitemnumber_pd_mir_manufacturer_addr_ls"
                ]
            });
            return {
                inventorynumber: inventoryDetailLookup["inventorynumber"],
                expirationdate: inventoryDetailLookup["expirationdate"],
                custitemnumber_aln_manufactured_date: inventoryDetailLookup["custitemnumber_aln_manufactured_date"],
                manufacturer: inventoryDetailLookup["custitemnumber_aae_manufacturerdetail"][0]?.text,
                manuAdress: inventoryDetailLookup["custitemnumber_pd_mir_manufacturer_addr_ls"]
            }
        }

        handler.getItemRecordType = (itemId) => {
            if (!itemId) return null;
            return search.lookupFields({
                type: search.Type.ITEM,
                id: itemId,
                columns: [
                    "recordtype"
                ]
            })["recordtype"];
        }

        handler.addressFinalData = (addressId) => {
            if (!addressId) return null;
            return search.lookupFields({
                type: "customrecord_aae_final_destination_cust",
                id: addressId,
                columns: [
                    "custrecord_aae_fdc_address"
                ]
            })["custrecord_aae_fdc_address"]
        }

        handler.transactionLookup = (transactionId) => {
            if (!transactionId) return null;
            return search.lookupFields({
                type: search.Type.TRANSACTION,
                id: transactionId,
                columns: [
                    "tranid"
                ]
            })["tranid"]
        }

        return handler;
    });