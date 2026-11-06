/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author Isaac Façanha de Carvalho
 */
define(
    [
        'N/log',
        'N/runtime',

        '../pd_cnt_common/pd-cntc-common.util.js'
    ],
    function(log) {
        function isEdition(context) {
            return context.type.anyOf([context.UserEventType.EDIT, context.UserEventType.XEDIT]);
        }

        function isCreation(context) {
            return context.type.anyOf([context.UserEventType.CREATE, context.UserEventType.COPY]);
        }

        function isVisualization(context) {
            return context.type.anyOf([context.UserEventType.VIEW]);
        }

        function isDeletion(context) {
            return context.type.anyOf([context.UserEventType.DELETE]);
        }
        
        return {
            isCreation: isCreation,
            isEdition: isEdition,
            isVisualization: isVisualization,
            isDeletion: isDeletion
        };
    }
)