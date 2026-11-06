/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author Isaac Façanha de Carvalho
 */
define(
    [
        'N/log',
        'N/cache',
        '../pd_cnt_common/pd-cntc-common.util.js'
    ],
    function(
        log,
        cache
    ) {
        const DEFAULT_GROUP_KEY = 'GENERAL-CACHE';
        const DEFAULT_SCOPE = cache.Scope.PROTECTED;
        const CACHE_SCOPE_OPTIONS = {
            private: cache.Scope.PRIVATE,
            protected: cache.Scope.PROTECTED,
            public: cache.Scope.PUBLIC
        }

        function remove(options) {
            const _cacheManager = cache.getCache({
                name: readName(options),
                scope: readScope(options)
            });

            _cacheManager.remove({ key: options.key });
        }

        function manage(options) {
            const _cacheManager = cache.getCache({
                name: readName(options),
                scope: readScope(options)
            });

            if(options.remove == true) {
                remove(options);
            }

            const _cacheValue = _cacheManager.get({
                key: options.key,
                loader: options.loader,
                ttl: readDuration(options)
            });

            if(_cacheValue == null) {
                return;
            }

            return JSON.parse(_cacheValue);

            function readDuration(options) {
                if(isNullOrEmpty(options.durationInMinutes)) {
                    return;
                }

                return (options.durationInMinutes * 60);
            }
        }

        function readName(options) {
            var _cacheName = options.groupKey;

            return (
                    isNullOrEmpty(_cacheName)
                ?   DEFAULT_GROUP_KEY
                :   _cacheName
            );
        }

        function readScope(options) {
            var _cacheScope = CACHE_SCOPE_OPTIONS[options.scope];

            return (
                    isNullOrEmpty(_cacheScope)
                ?   DEFAULT_SCOPE
                :   _cacheScope
            );
        }

        return {
            manage: manage,
            remove: remove
        }
    }
)