(function($) {
    $.fn.rows = $.fn.lines = function() {
        const _tableElement = $(this);
        const _isLoaded = (_tableElement.find('thead th').length > 0);
        
        if(!_isLoaded) {
            return [];
        }

        return _tableElement.bootstrapTable('getData', { formatted: false });
    }

    $.fn.selectedRows = $.fn.selectedLines = function() {
        const _tableElement = $(this);
        const _isLoaded = (_tableElement.find('thead th').length > 0);
        
        if(!_isLoaded) {
            return [];
        }

        return _tableElement.bootstrapTable('getSelections');
    }
}(jQuery))

function buildTable(options) {
    const _tableElement = $(options.id);
    const _columns = options.columns;
    const _requestOptions = $.extend({ parameters: options.parameters }, options.restlet);

    _tableElement.bootstrapTable('destroy');
    _tableElement.css({
        'margin-top': '0px'
    });
    _tableElement.parent().css({
        'margin-top': '20px'
    });

    updateTableMessage(_tableElement, options.searchingText, true);

    _tableElement.data('options', options);
    
    setTimeout(
        () => {
            get(
                _requestOptions,
                (response) => {
                    let _data = dataHandler({ response: response, tableElement: _tableElement });

                    if(typeof(options.beforeLoad) == 'function') {
                        options.beforeLoad(_data);
                    }

                    if(typeof(options.onNavigationEnded) == 'function') {
                        options.onNavigationEnded(_data);
                    }
                    
                    paginationBuilder({ response: response, tableElement: _tableElement });

                    if (isNullOrEmpty(_data)) {
                        updateTableMessage(_tableElement, `<i class="fa fa-exclamation text-info"></i>${options.emptyDataMessage}`);
                        return;
                    }

                    updateTableMessage(_tableElement, options.loadingText || 'Carregando...', true);

                    let _transformedData = options.transform ? options.transform(_data) : _data;

                    _tableElement
                        .bootstrapTable({
                            height: options.height || 400,
                            columns: _columns.map(function (column) {
                                return {
                                    field: column.name,
                                    title: column.title,
                                    checkbox: column?.checkbox,
                                    align: column?.align,
                                    visible: column?.visible,
                                    valign: 'middle',
                                    formatter: column?.formatter
                                };
                            }),
                            onPostBody: () => { options.onPostBody ? options.onPostBody() : undefined },
                            data: _transformedData,
                            fixedColumns: (options?.freezeColumns?.left != null || options?.freezeColumns?.right != null),
                            fixedNumber: options?.freezeColumns?.left || 3,
                            fixedRightNumber: options?.freezeColumns?.right || 1,
                            onExpandRow: options?.onExpandRow
                        });
                },
                (errorMessage) => { 
                    onError(_tableElement, errorMessage);

                    if(options.onError) {
                        options.onError(_tableElement, errorMessage);
                    }
                }
            );
        }, 1000
    );

    _tableElement
        .removeClass('is-builded')
        .addClass('is-builded');

    function paginationBuilder(options) {
        const _page = options.response.page;
        const _hasPagination = (_page != null && _page.data != null);

        options.tableElement.next('.pagination-container').remove();

        if(!_hasPagination) {
            return;
        }
        
        options.tableElement.data('page-info', _page);
        options.tableElement.after(
            [
                `<div class="row justify-content-sm-center pagination-container" style="margin-top: 15px;">`,
                    `<div class="col-sm-auto">`,
                        `<button type="button" class="btn btn-light btn-sm" style="margin-right: 10px" onclick="navigatePage('first', '${options.tableElement.prop('id')}')" ${_page.isFirst ? 'disabled' : ''}><i class="fa fa-angle-double-left text-info"></i>Primeira</button>`,
                        `<button type="button" class="btn btn-light btn-sm" onclick="navigatePage('previous', '${options.tableElement.prop('id')}')" ${_page.isFirst ? 'disabled' : ''}><i class="fa fa-angle-left text-info"></i>Anterior</button>`,
                    `</div>`,
                    `<div class="col-sm-auto" role="toolbar">`,
                        `<div class="form-group">`,
                            `<span class="form-control form-control-sm">Exibindo página ${_page.number} de ${_page.count}</span>`,
                        `</div>`,
                    `</div>`,
                    `<div class="col-sm-auto">`,
                        `<button type="button" class="btn btn-light btn-sm" style="margin-right: 10px" onclick="navigatePage('next', '${options.tableElement.prop('id')}')" ${_page.isLast ? 'disabled' : ''}><i class="fa fa-angle-right text-info"></i>Próxima</button>`,
                        `<button type="button" class="btn btn-light btn-sm" onclick="navigatePage('last', '${options.tableElement.prop('id')}')" ${_page.isLast ? 'disabled' : ''}><i class="fa fa-angle-double-right text-info"></i>Última</button>`,
                    `</div>`,
                `</div>`,
            ].join('')
        );
    }

    function dataHandler(options) {
        var _hasPagination = (options.response.page != null && options.response.page.data != null);

        if(_hasPagination) {
            return options.response.page.data;
        }

        return options.response;
    }

    function onError(container, errorMessage) {
        updateTableMessage(
            container, 
            `<i class="fa fa-exclamation-triangle text-danger"></i> Aconteceu um problema ao tentar carregar essa lista! Detalhes abaixo: <br /><br /> ${errorMessage}`
        );
    }

    function updateTableMessage(container, text, isLoadingText) {
        setTimeout(
            () => {
                if (isLoadingText) {
                    text = `<i class="fa fa-spin fa-spinner text-info"></i>${text}`;
                }
    
                container.find('.empty-table-message').html(text);
            }, 100
        );
    }
}

function navigatePage(navigationCommand, tableId) {
    const _tableElement = $('#' + tableId);
    const _tableOptions = _tableElement.data('options');
    const _pageInfo = _tableElement.data('page-info');

    switch(navigationCommand) {
        case 'first': 
            {
                _tableOptions.parameters.page = 1;
            } break;
        case 'previous': 
            {
                _tableOptions.parameters.page = parseFloat(_pageInfo.number) - 1;
            } break;
        case 'next': 
            {
                _tableOptions.parameters.page = parseFloat(_pageInfo.number) + 1;
            } break;
        case 'last': 
            {
                _tableOptions.parameters.page = _pageInfo.count;
            } break;
    };

    const _navigationLoading = loading('Atualizando dados...');

    buildTable(
        $.extend(_tableOptions, {
            isPagination: true,
            onNavigationEnded: function() {
                _navigationLoading.modal('hide');
            }
        })
    );
}