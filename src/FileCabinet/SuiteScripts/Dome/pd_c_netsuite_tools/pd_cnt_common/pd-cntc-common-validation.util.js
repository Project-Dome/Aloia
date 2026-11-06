/**
 * @author Isaac Façanha de Carvalho
 */

String.prototype.isValidCNPJ = function () {
    var _cnpj = this.replace(/[^0-9]/g, '').replace(/\s+/g, '');
    var _isValid = false;

    if (_cnpj.length == 14) {
        var nonValidValues = [
            '00000000000000', '11111111111111', '22222222222222',
            '33333333333333', '44444444444444', '55555555555555',
            '66666666666666', '77777777777777', '88888888888888',
            '99999999999999'
        ];

        if (!_cnpj.anyOf(nonValidValues)) {
            var _calculationAmount = 0;
            var _cnpjArray = _cnpj.split('').map(function (number) { return parseFloat(number); });

            [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2].forEach(function (number, index) {
                _calculationAmount += (number * _cnpjArray[index]);
            });

            var _rest = (_calculationAmount % 11);

            _rest = (_rest < 2 ? 0 : (11 - _rest));

            if (_rest == _cnpjArray[12]) {
                _calculationAmount = 0;
                _rest = 0;

                [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2].forEach(function (number, index) {
                    _calculationAmount += (number * _cnpjArray[index]);
                });

                _rest = (_calculationAmount % 11);
                _rest = (_rest < 2 ? 0 : (11 - _rest));

                _isValid = (_rest == _cnpjArray[13]);
            }
        }
    }

    return _isValid;
}

String.prototype.isValidCPF = function () {
    var _cpf = this.replace(/[^0-9]/g, '').replace(/\s+/g, '');
    var _isValid = false;

    if (_cpf.length == 11) {
        var nonValidValues = [
            '00000000000', '11111111111', '22222222222',
            '33333333333', '44444444444', '55555555555',
            '66666666666', '77777777777', '88888888888',
            '99999999999'
        ];

        if (!_cpf.anyOf(nonValidValues)) {
            var _calculationAmount = 0;
            var _cpfArray = _cpf.split('').map(function (number) { return parseFloat(number); });

            [10, 9, 8, 7, 6, 5, 4, 3, 2].forEach(function (number, index) {
                _calculationAmount += (number * _cpfArray[index]);
            });

            var _rest = ((_calculationAmount * 10) % 11);

            _rest = (_rest == 10 ? 0 : _rest);

            if (_rest == _cpfArray[9]) {
                _calculationAmount = 0;
                _rest = 0;

                [11, 10, 9, 8, 7, 6, 5, 4, 3, 2].forEach(function (number, index) {
                    _calculationAmount += (number * _cpfArray[index]);
                });

                _rest = ((_calculationAmount * 10) % 11);
                _rest = (_rest == 10 ? 0 : _rest);

                _isValid = (_rest == _cpfArray[10]);
            }
        }
    }

    return _isValid;
}

String.prototype.isValidCEP = function () {
    return this.replace(/[^0-9]/g, '').length >= 8;
}

String.prototype.isValidEmail = function () {
    var _text = this;
    var _emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    var _specialCaractersRegex = /[áàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ&]/;

    return (
            _emailRegex.test(_text)
        && !_specialCaractersRegex.test(_text)
    );
}

String.prototype.isValidDate = function (options) {
    var _isValid = false;
    var _languageKey = (
            options == null || isNullOrEmpty(options.key)
        ?   'pt-br'
        :   options.key
    );

    var _strDate = this.toString();

    if (!isNullOrEmpty(_strDate)) {
        var _dateMapByKey = {
            'pt-br': { day: 0, month: 1, year: 2, separator: '/' },
            'en-us': { day: 1, month: 0, year: 2, separator: '/' },
            'iso': { day: 2, month: 1, year: 0, separator: '-' }
        };

        var _map = _dateMapByKey[_languageKey];

        if (_map != null) {
            var _dateArray = _strDate.split(_map.separator);

            var _day = parseFloat(_dateArray[_map['day']]);
            var _month = (parseFloat(_dateArray[_map['month']]) - 1);
            var _year = parseFloat(_dateArray[_map['year']]);

            var _dateToCompare = new Date(_year, _month, _day, 12, 00, 00);

            _isValid = (
                    _day == _dateToCompare.getDate()
                &&  _month == _dateToCompare.getMonth()
                &&  _year == _dateToCompare.getFullYear()
            );
        } else {
            throw 'No validation implemented for the key "'+ _languageKey +'"';
        }
    }

    return _isValid;
}

String.prototype.isValidUrl = function() {
    var _urlValue = this;
    var _matches = _urlValue.match(
        /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/g
    );

    return (
            _matches != null 
        &&  _matches.length > 0
    );
}