(function($) {
    $.fn.readData = function() {
        let _container = $(this);
        let _data = {};

        _container.find('input, select, textarea').each(function() {
            let _element = $(this);
            let _elementName = (_element.prop('name') || _element.prop('id'));

            _data[_elementName] = getElementValue(_element);
        });

        return _data;        
    }

    function getElementValue(element) {
        let _value = element.val();
    
        if(isNullOrEmpty(_value)) {
            return null;
        }
        
        let _isAutoComplete = element.is('.autocomplete');
        let _isCheckbox = element.is('[type=checkbox]');
        let _isNumeric = element.is('.numeric');
        let _isCurrency = element.is('.currency');
        let _isDate = element.is('.date') || element.is('.date-picker');
    
        if(_isAutoComplete) {
            return {
                id: element.data('value'),
                name: _value
            };
        }
    
        if(_isCheckbox) {
            return element.is(':checked');
        }
    
        if(_isCurrency || _isNumeric) {
            return parseFloat(_value.replace(/\./g, '').replace(',', '.'));
        }

        if(_isDate) {
            if(_value.isValidDate()) {
                return _value.toDate({ type: 'pt-br' }).format({ type: 'iso' });
            }

            return null;
        }
    
        return _value;
    }
} (jQuery));

$(document).ready(function() {
    manageFormating($('body'));
});

function manageFormating(containerElement) {
    manageCurrency(containerElement);

    function manageCurrency(containerElement) {
        containerElement.find('.currency, .numeric').mask('#.##0,00', { reverse: true });
    }
}