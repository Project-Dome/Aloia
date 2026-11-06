/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author Isaac Façanha de Carvalho
 */
define(
    [
        'N/file',
        './pd-cnts-search.util',
        './pd-cnts-exception.util.js'
    ],
    function(file, search_util) {
        function getFilePath(partialPath) {
            var _filesFound = getFileByPath(partialPath);

            validateFilesFound(_filesFound);

            var _file = file.load({ id: _filesFound[0].id });

            return _file.path;

            function validateFilesFound(filesFound) {
                if(isNullOrEmpty(filesFound)) {
                    throw buildException({
                        code: 'FILE_NOT_FOUND',
                        message: 'No file found with the following partial path: ' + partialPath
                    });
                }
    
                if(filesFound.length > 1) {
                    throw buildException({
                        code: 'DUPLICATED_FILES',
                        message: (filesFound.length + ' files found with this path: ' + partialPath)
                    });
                }
            }
        }

        function getFileByPath(partialPath) {
            if(isNullOrEmpty(partialPath)) {
                buildException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, 'partialPath');
            }

            var _columns = {
                name: { name: 'name' },
                directory: { name: 'formulatext', formula: '{folder}' },
                lasModified: { name: 'modified', sort: 'DESC' }
            };

            return search_util.get({
                type: 'file',
                columns: _columns,
                query: search_util
                    .where(search_util.query(_columns.name, 'contains', partialPath))
                    .or(search_util.query(_columns.directory, 'is', partialPath))
            });
        }

        function getFolderByName(name) {
            if(isNullOrEmpty(name)) {
                buildException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, 'name');
            }

            var _columns = {
                name: { name: 'name' }
            };

            return search_util.first({
                type: 'folder',
                columns: _columns,
                query: search_util
                    .where(search_util.query(_columns.name, 'is', name))
            });
        }

        return {
            getFilePath: getFilePath,
            getFileByPath: getFileByPath,
            getFolderByName: getFolderByName
        }
    }
)