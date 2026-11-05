/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 *
 * ss_pd_tno_backfill_dates.js
 * Backfill de Ship Date / Delivery Date em registros existentes
 * de customrecord_pd_tno_track_notification a partir do last_body.
 */
define(['N/search', 'N/record', 'N/runtime', 'N/task', 'N/log'],
    (search, record, runtime, task, log) => {

    const RECORD_TYPE = 'customrecord_pd_tno_track_notification';
    const FIELD_LAST_BODY = 'custrecord_pd_tno_last_body';
    const FIELD_SHIP_DATE = 'custrecord_pd_tno_ship_date';
    const FIELD_DELIVERY_DATE = 'custrecord_pd_tno_delivery_date';
    const GOVERNANCE_THRESHOLD = 100; // margem de segurança pra reagendar antes de estourar

    const findMilestone = (milestones, key) =>
        milestones.find((m) => m.key_stage === key && m.time_iso);

    const execute = (context) => {
        const searchObj = search.create({
            type: RECORD_TYPE,
            filters: [
                [FIELD_LAST_BODY, 'isnotempty', ''],
                'AND',
                [FIELD_SHIP_DATE, 'isempty', ''] // só pega quem ainda não foi processado
            ],
            columns: ['internalid']
        });

        const pagedData = searchObj.runPaged({ pageSize: 1000 });
        let processed = 0;
        let stoppedEarly = false;

        outer:
        for (let p = 0; p < pagedData.pageRanges.length; p++) {
            const page = pagedData.fetch({ index: p });

            for (const result of page.data) {
                if (runtime.getCurrentScript().getRemainingUsage() < GOVERNANCE_THRESHOLD) {
                    stoppedEarly = true;
                    break outer;
                }

                const id = result.getValue({ name: 'internalid' });

                try {
                    const rawBody = search.lookupFields({
                        type: RECORD_TYPE,
                        id: id,
                        columns: [FIELD_LAST_BODY]
                    })[FIELD_LAST_BODY];

                    const payload = JSON.parse(rawBody);
                    const milestones = payload?.data?.track_info?.milestone;
                    if (!Array.isArray(milestones)) continue;

                    const values = {};
                    const pickedUp = findMilestone(milestones, 'PickedUp');
                    if (pickedUp) values[FIELD_SHIP_DATE] = new Date(pickedUp.time_iso);

                    const delivered = findMilestone(milestones, 'Delivered');
                    if (delivered) values[FIELD_DELIVERY_DATE] = new Date(delivered.time_iso);

                    if (Object.keys(values).length > 0) {
                        record.submitFields({
                            type: RECORD_TYPE,
                            id: id,
                            values: values,
                            options: { enableSourcing: false, ignoreMandatoryFields: true }
                        });
                        processed++;
                    }
                } catch (e) {
                    log.error({ title: `Erro no registro ${id}`, details: e.message });
                }
            }
        }

        log.audit({
            title: 'Backfill concluído (ou pausado)',
            details: `Processados: ${processed} | Parou por governance: ${stoppedEarly}`
        });

        if (stoppedEarly) {
            const scriptTask = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: runtime.getCurrentScript().id,
                deploymentId: runtime.getCurrentScript().deploymentId
            });
            scriptTask.submit();
            log.audit({ title: 'Reagendado', details: 'Nova execução enfileirada para continuar o backfill' });
        }
    };

    return { execute };
});