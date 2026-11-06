$(document).ready(function() {
    manageAutocompleteElements();
});

function manageAutocompleteElements(container) {
    if(container == null) {
        container = $(document);
    }

    container.find('.autocomplete').each(function() {
        const _element = $(this);

        _element
            .on('change', function() {
                var _value = _element.val();

                if(isNullOrEmpty(_value)) {
                    _element.data('value', null);
                    _element.trigger('data-value-changed');
                }
            });

        buildAutocomplete(_element);
    });
}

async function buildAutocomplete(autocompleteElement) {
    const _elementId = autocompleteElement.attr('id');
    const _filterElementsSeletor = autocompleteElement.data('filter-elements-selector');
    const _treshold = autocompleteElement.data('autocomplete-treshold');
    const _maxItems = autocompleteElement.data('autocomplete-max-items');
    const _openOnClick = autocompleteElement.data('open-on-click');

    const _defaultOptions = {
        source: [],
        highlightClass: 'text-info',
        maximumItems: (isNullOrEmpty(_maxItems) ? 10 : parseInt(_maxItems)),
        treshold: (isNullOrEmpty(_treshold) ? 0 : parseInt(_treshold)),
        onClick: _openOnClick
    };
    
    autocompleteElement.data('old-placeholder', autocompleteElement.attr('placeholder'));
    autocompleteElement.data('default-options', _defaultOptions);
    autocompleteElement.autocomplete(_defaultOptions);

    $(_filterElementsSeletor).each(function() {
        const _filterElement = $(this);
        const _isAutocomplete = _filterElement.is('.autocomplete');

        if(_isAutocomplete) {
            _filterElement.on('data-value-changed', function() {
                updateOptions(autocompleteElement);
            });
        } else {
            _filterElement.on('change', function() {
                updateOptions(autocompleteElement);
            });
        }
    });

    updateOptions(autocompleteElement);

    function updateOptions(autocompleteElement) {
        let _restletParameters = {};
        const _restletOptions = {
            script: autocompleteElement.data('restlet-script-id'),
            deployment: autocompleteElement.data('restlet-deployment-id'),
            parameters: _restletParameters
        };

        if(isNullOrEmpty(_restletOptions.script) || isNullOrEmpty(_restletOptions.deployment)) {
            console.error(`Missing restlet options! #${_elementId}`);
    
            return;
        }

        if(!isNullOrEmpty(_filterElementsSeletor)) {
            $(_filterElementsSeletor).each(function() {
                const _element = $(this);
                const _elementId = _element.attr('id');
    
                if(!isNullOrEmpty(_elementId)) {
                    _restletParameters[_elementId] = (_element.data('value') || _element.val());
                }
            });
        }

        autocompleteElement.attr('placeholder', autocompleteElement.data('old-placeholder'))
        autocompleteElement.attr('data-status', 'loading');
        autocompleteElement.attr('disabled', 'disabled');

        get(
            _restletOptions,
            function(data) {
                let _options = {};
                const _autocompleteOptions = autocompleteElement.data('default-options');
                const _currentId = autocompleteElement.data('value');
                let _selectedItem = {};
                let _currentIdExists = false;
                
                data.forEach(
                    (dataItem) => {
                        if(!_currentIdExists) {
                            _currentIdExists = (_currentId == dataItem.id);

                            if(_currentIdExists) {
                                _selectedItem = dataItem;
                            }
                        }
                        
                        _options[dataItem.name] = dataItem.id;
                    }
                );

                if(!_currentIdExists) {
                    autocompleteElement.val('');
                    autocompleteElement.data('value', null);
                }

                if(_selectedItem != null) {
                    autocompleteElement.val(_selectedItem.name);
                    autocompleteElement.data('value', _selectedItem.id);
                }

                autocompleteElement.data('restlet-data', data);
                autocompleteElement.removeAttr('disabled');
                autocompleteElement.attr('placeholder', autocompleteElement.data('placeholder'));
                autocompleteElement.autocomplete(
                    $.extend(_autocompleteOptions, {
                        source: _options,
                        onSelectItem: (item, element) => {
                            $(element).data('value', item.value).trigger('data-value-changed');
                        }
                    })
                );
                autocompleteElement.trigger('build-complete');
                autocompleteElement.attr('data-status', 'loaded');
            },
            function(errorMessage) {
                autocompleteElement.attr('data-status', 'error');
                autocompleteElement.val(errorMessage)
            }
        );
    }
}