function readFile(onContentReady) {
    const _inputFile = $('<input id="" type="file" class="hidden"/>');

    $('body').append(_inputFile);
    
    _inputFile.on('change', function() {
        console.log('File Element', this);

        if(this.files != null && this.files.length > 0) {
            const _file = this.files[0];
            const _fileReader = new FileReader();

            console.log('File', _file);

            _fileReader.addEventListener('load', function(event) {
                const _fileContent = event.target.result;

                onContentReady(
                    _file,
                    _fileContent
                );
            });
        
            _fileReader.readAsText(_file, 'utf8');
        }
    });

    _inputFile.trigger('click');
}