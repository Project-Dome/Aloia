(function ($) {
    var defaults = {
        treshold: 4,
        maximumItems: 5,
        highlightTyped: true,
        highlightClass: 'text-primary'
    };
    function createItem(lookup, item, opts) {
        var label;
        if (opts.highlightTyped) {
            var idx = item.label.toLowerCase().indexOf(lookup.toLowerCase());
            label = item.label.substring(0, idx)
                + '<span class="' + expandClassArray(opts.highlightClass) + '">' + item.label.substring(idx, idx + lookup.length) + '</span>'
                + item.label.substring(idx + lookup.length, item.label.length);
        }
        else {
            label = item.label;
        }
        return '<button type="button" class="dropdown-item" data-value="' + item.value + '">' + label + '</button>';
    }
    function expandClassArray(classes) {
        if (typeof classes == "string") {
            return classes;
        }
        if (classes.length == 0) {
            return '';
        }
        var ret = '';
        for (var _i = 0, classes_1 = classes; _i < classes_1.length; _i++) {
            var clas = classes_1[_i];
            ret += clas + ' ';
        }
        return ret.substring(0, ret.length - 1);
    }
    function createItems(field, opts) {
        const _itemsQuantity = (
                opts.source.length == null
            ?   Object.keys(opts.source).length
            :   opts.source.length
        )
        const _hasOnClick = (
                opts.onClick == true
            ||  (
                        _itemsQuantity <= opts.maximumItems
                    &&  _itemsQuantity > 0
                )
        );
        var lookup = field.val();
        if (lookup.length < opts.treshold || (lookup.length == 0 && !_hasOnClick) || _itemsQuantity == 0) {
            field.dropdown('hide');
            disableDropdown(field);
            return 0;
        }
        var items = field.siblings('.dropdown-menu');
        items.html('');
        var count = 0;
        var keys = Object.keys(opts.source);
        
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var object = opts.source[key];
            var item = {
                label: opts.label ? object[opts.label] : key,
                value: opts.value ? object[opts.value] : object
            };
            if (item.label.toLowerCase().indexOf(lookup.toLowerCase()) >= 0) {
                items.append(createItem(lookup, item, opts));
                if (opts.maximumItems > 0 && ++count >= opts.maximumItems) {
                    break;
                }
            }
        }

        if(count > 0) {
            enableDropdown(field);
        } else {
            disableDropdown(field);
        }

        // option action
        field.siblings('.dropdown-menu').find('.dropdown-item').click(function () {
            field.val($(this).text());
            if (opts.onSelectItem) {
                opts.onSelectItem({
                    value: $(this).data('value'),
                    label: $(this).text()
                }, field[0]);
            }
        });
        return items.children().length;
    }

    function enableDropdown(field) {
        field.attr('data-toggle', 'dropdown');
        field.addClass('dropdown-toggle');
        field.parent().find('.dropdown-menu').removeClass('hidden');
    }

    function disableDropdown(field) {
        field.removeAttr('data-toggle');
        field.removeClass('dropdown-toggle');
        field.parent().find('.dropdown-menu').not('.hidden').addClass('hidden');
    }

    $.fn.autocomplete = function (options) {
        // merge options with default
        var opts = {};
        $.extend(opts, defaults, options);
        var _field = $(this);
        // clear previously set autocomplete
        _field.parent().removeClass('dropdown');
        _field.removeAttr('data-toggle');
        _field.removeClass('dropdown-toggle');
        _field.parent().find('.dropdown-menu').remove();
        _field.dropdown('dispose');
        // attach dropdown
        _field.parent().addClass('dropdown');
        
        var dropdown = $('<div class="dropdown-menu" ></div>');
        // attach dropdown class
        if (opts.dropdownClass)
            dropdown.addClass(opts.dropdownClass);
        _field.after(dropdown);
        _field.dropdown(opts.dropdownOptions);

        console.info('autocomplete-options', opts);
        _field.parent().find('.dropdown-menu').not('.hidden').addClass('hidden');
        
        const _itemsQuantity = (
                opts.source.length == null
            ?   Object.keys(opts.source).length
            :   opts.source.length
        )
        const _addOnClick = (
                opts.onClick == true
            ||  (
                        _itemsQuantity <= opts.maximumItems
                    &&  _itemsQuantity > 0
                )
        );

        _field.data('options', opts);

        if(_addOnClick) {
            this.off('click.autocomplete').click('click.autocomplete', function (e) {
                let _element = $(this);
                let _options = _element.data('options');

                if (createItems(_element, _options) == 0) {
                    e.stopPropagation();
                    _element.dropdown('hide');
                }
            });
        }
        
        this.off('keyup.autocomplete').keyup('keyup.autocomplete', function () {
            let _element = $(this);
            let _options = _element.data('options');

            if (createItems(_element, _options) > 0) {
                _element.dropdown('show');
            }
            else {
                _element.dropdown('hide');
                disableDropdown(_element);
            }
        });
        return this;
    };
}(jQuery));