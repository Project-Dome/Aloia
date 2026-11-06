(function($) {
    const REQUIRED_OPTIONS = [
        'type'
    ];

    const DEFAULT_OPTIONS = {
        type: 'alert',
        config: {
            alert: { 
                confirm: {
                    text: 'Ok', 
                    iconClass: 'check text-success', 
                    validate: () => true,
                    onConfirmation: () => {}
                },
                cancel: {
                    text: 'Cancelar', 
                    iconClass: 'times text-danger'
                }
            }
        }
    };

    $.modal = function(options) {
        let _modal = null;

        validateOptions(options);

        switch(options.type) {
            case 'alert':
                {
                    _modal = buildAlert(options);
                } break;
            case 'html':
                {
                    _modal = buildHtml(options);
                } break;
            default:
                throw new Error(`Invaid modal type: ${options.type}`);
        }

        return _modal;

        function validateOptions(options) {
            if(options == null) {
                throw new Error('Missing "options" parameter!');
            }

            REQUIRED_OPTIONS.forEach(
                (optionName) => {
                    if(options[optionName] == null) {
                        throw new Error(`Missing required option: ${optionName}`)
                    }
                }
            );
        }

        function buildHtml(options) {
            validateHTML(options);

            return buildModal($.extend(options, { body: options.html }));

            function validateHTML(options) {
                if(isNullOrEmpty(options.html)) {
                    throw new Error('Missing "html" option!');
                }
            }
        }

        function buildAlert(options) {
            validateAlert(options);

            if(isNullOrEmpty(options.title)) {
                options.title = '<i class="fa fa-exclamation-triangle text-warning"></i>Atenção!';
            }

            return buildModal($.extend(options, { body: options.message }));

            function validateAlert(options) {
                if(isNullOrEmpty(options.message)) {
                    throw new Error('Missing "message" option!');
                }
            }
        }

        function buildModal(options) {
            let _sizeClass = '';

            if(options.size == 'small') {
                _sizeClass = 'modal-sm';
            } else if(options.size == 'large') {
                _sizeClass = 'modal-lg';
            } else if(options.size == 'extra-large') {
                _sizeClass = 'modal-xl';
            }

            const _isStatic = options.isStatic == true;
            const _modalContent = (
                [
                    '<div class="modal" tabindex="-1" role="dialog">',
                        `<div class="modal-dialog ${_sizeClass}" role="document">`,
                            '<div class="modal-content">',
                                '<div class="modal-header">',
                                    `<h5 class="modal-title">${options.title}</h5>`,
                                '</div>',
                                '<div class="modal-body">',
                                    options.body,
                                '</div>',
                                '<div class="modal-footer">',
                                '</div>',
                            '</div>',
                        '</div>',
                    '</div>'
                ].join('')
            );

            const _modal = $(_modalContent);

            _modal.on('hidden.bs.modal', 
                () => {
                    _modal.remove() 
                    
                    if(typeof(options.onClose) == 'function') {
                        options.onClose();
                    }
                }
            );

            _modal.on('shown.bs.modal', 
                () => {
                    if(options.ready) {
                        options.ready(_modal);
                    }
                }
            );

            if(_isStatic) {
                _modal.modal({
                    keyboard: false,
                    backdrop: 'static'
                });
            } else {
                const _closeButton = (
                    [
                        '<button type="button" class="close" data-dismiss="modal" aria-label="Close">',
                            '<span aria-hidden="true">&times;</span>',
                        '</button>',
                    ].join('')
                );

                _modal.find('.modal-header').append(_closeButton);
            }

            manageButtons(_modal, options);

            if(options.beforeOpen != null) {
                options.beforeOpen(_modal, options);
            }

            if(options.beforeLoad) {
                options.beforeLoad(_modal);
            }

            _modal.modal('show');

            return _modal;

            function manageButtons(modal, options) {
                if(options.buttons == false) {
                    return;
                }

                if(options.buttons == null) {
                    const _defaultButton = $(
                        [
                            '<button type="button" class="btn btn-light modal-button button-ok">',
                                '<i class="fa fa-check text-success"></i>Ok',
                            '</button>'
                        ].join('')
                    );
    
                    _defaultButton.on('click', () => modal.modal('hide'));
    
                    modal.find('.modal-footer').append(_defaultButton);
                } else {
                    const _footer = modal.find('.modal-footer');
                    const _buttons = buildButtons(modal, options.buttons);
    
                    _buttons.forEach(
                        (button) => {
                            _footer.append(button);
                        }
                    );
                }
            }
        }

        function buildButtons(modal, config) {
            validateConfig(config);

            const _buttonsElements = [];

            for(const configKey in config) {
                const _buttonConfig = config[configKey];
                const _action = (
                    _buttonConfig.isCloser
                    ?   closerAction
                    :   _buttonConfig.action
                );

                const _button = $(`<button type="button" class="btn btn-light modal-button button-${config}">${_buttonConfig.text}</button>`);

                _button.on('click', function() {
                    _action(modal, _buttonConfig, _button);
                });

                _buttonsElements.push(_button);
            }

            return _buttonsElements;

            function closerAction(modal, config) {
                if(config.action != null) {
                    config.action(modal);
                }

                modal.modal('hide');
            }

            function validateConfig(config) {
                for(const configKey in config) {
                    const _buttonConfig = config[configKey];

                    if(isNullOrEmpty(_buttonConfig.text)) {
                        throw new Error(`Missing "text" option on button "${configKey}"!`);
                    }

                    if(!_buttonConfig.isCloser && _buttonConfig.action == null) {
                        throw new Error(`You must inform one of the following options for button "${configKey}": isCloser = true, action = function`);
                    }
                }
            }
        }
    }

}(jQuery));

function loading(loadingText, loadingTitle) {
    return $.modal({
        type: 'html',
        isStatic: true,
        title: loadingTitle || 'Aguarde!',
        html: '<i class="fa fa-spinner fa-spin text-info"></i>' + (
                isNullOrEmpty(loadingText)
            ?   'Carregando...'
            :   loadingText
        ),
        buttons: false
    });
}