/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * ue_pd_tno_fill_dates.js
 * Preenche Ship Date e Delivery Date no customrecord_pd_tno_track_notification.
 * Fonte primária: milestone[] do last_body (com timezone confiável).
 * Fallback: parse de custrecord_pd_tno_historical (SEM timezone — usar com ressalva).
 */
define(['N/log'], (log) => {

    const FIELD_LAST_BODY = 'custrecord_pd_tno_last_body';
    const FIELD_HISTORICAL = 'custrecord_pd_tno_historical';
    const FIELD_SHIP_DATE = 'custrecord_pd_tno_ship_date';
    const FIELD_DELIVERY_DATE = 'custrecord_pd_tno_delivery_date';

    // Parser do campo historical: "Stage - MM/DD/YYYY - HH:mm" repetido,
    // separado por <br>, \n, \r\n ou combinação — não confia em um único delimitador.
    const parseHistorical = (historicalStr, recordId) => {
        if (!historicalStr) return {};

        const entryRegex = /(\w+)\s*-\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}):(\d{2})/g;
        const result = {};
        let match;
        let matchCount = 0;

        while ((match = entryRegex.exec(historicalStr)) !== null) {
            matchCount++;
            const [, stage, month, day, year, hour, minute] = match;
            // ATENÇÃO: sem timezone. Assume fuso do processo NetSuite (validar antes de confiar no SLA).
            const parsedDate = new Date(
                parseInt(year), parseInt(month) - 1, parseInt(day),
                parseInt(hour), parseInt(minute)
            );

            if (isNaN(parsedDate.getTime())) {
                log.debug({
                    title: `[${recordId}] Data inválida no historical`,
                    details: match[0]
                });
                continue;
            }

            result[stage] = parsedDate;
        }

        if (matchCount === 0) {
            log.debug({
                title: `[${recordId}] Nenhuma entrada casou no historical`,
                details: historicalStr
            });
        }

        return result; // ex: { PickedUp: Date, Delivered: Date }
    };

    const beforeSubmit = (context) => {
        const recordId = context.newRecord.id || '(novo registro)';

        if (context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.EDIT &&
            context.type !== context.UserEventType.XEDIT) {
            log.debug({
                title: `[${recordId}] Ignorado`,
                details: `Tipo de evento não tratado: ${context.type}`
            });
            return;
        }

        const newRecord = context.newRecord;
        const fieldsUpdated = [];
        let dateSource = null;

        // --- Tentativa 1: last_body (fonte confiável, com timezone) ---
        const rawBody = newRecord.getValue({ fieldId: FIELD_LAST_BODY });
        let pickedUpDate = null;
        let deliveredDate = null;

        if (rawBody) {
            try {
                const payload = JSON.parse(rawBody);
                const milestones = payload?.data?.track_info?.milestone;

                if (Array.isArray(milestones)) {
                    const findMilestone = (key) =>
                        milestones.find((m) => m.key_stage === key && m.time_iso);

                    const pickedUp = findMilestone('PickedUp');
                    const delivered = findMilestone('Delivered');

                    if (pickedUp) pickedUpDate = new Date(pickedUp.time_iso);
                    if (delivered) deliveredDate = new Date(delivered.time_iso);

                    if (pickedUp || delivered) dateSource = 'last_body';
                } else {
                    log.debug({
                        title: `[${recordId}] Sem milestone[] no last_body`,
                        details: 'Payload não contém data.track_info.milestone como array'
                    });
                }
            } catch (e) {
                log.error({
                    title: `[${recordId}] Falha ao parsear last_body`,
                    details: e.message
                });
            }
        } else {
            log.debug({
                title: `[${recordId}] Sem last_body`,
                details: 'Campo custrecord_pd_tno_last_body vazio nesta submissão'
            });
        }

        // --- Tentativa 2 (fallback): historical, só pro que não veio do last_body ---
        if (!pickedUpDate || !deliveredDate) {
            const historicalStr = newRecord.getValue({ fieldId: FIELD_HISTORICAL });
            if (historicalStr) {
                const parsed = parseHistorical(historicalStr, recordId);

                if (!pickedUpDate && parsed.PickedUp) {
                    pickedUpDate = parsed.PickedUp;
                    dateSource = dateSource ? `${dateSource}+historical` : 'historical';
                }
                if (!deliveredDate && parsed.Delivered) {
                    deliveredDate = parsed.Delivered;
                    dateSource = dateSource ? `${dateSource}+historical` : 'historical';
                }
            }
        }

        // --- Gravação ---
        if (pickedUpDate) {
            newRecord.setValue({ fieldId: FIELD_SHIP_DATE, value: pickedUpDate });
            fieldsUpdated.push(`ship_date=${pickedUpDate.toISOString()}`);
        }
        if (deliveredDate) {
            newRecord.setValue({ fieldId: FIELD_DELIVERY_DATE, value: deliveredDate });
            fieldsUpdated.push(`delivery_date=${deliveredDate.toISOString()}`);
        }

        log.audit({
            title: `[${recordId}] Resultado`,
            details: fieldsUpdated.length > 0
                ? `Fonte: ${dateSource} | Campos atualizados: ${fieldsUpdated.join(', ')}`
                : 'Nenhum campo atualizado (sem dados utilizáveis em last_body nem historical)'
        });
    };

    return { beforeSubmit };
});