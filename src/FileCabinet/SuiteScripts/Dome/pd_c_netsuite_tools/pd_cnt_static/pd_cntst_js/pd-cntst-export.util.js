function generateExcelDownload(exportationData) {
	download(
		exportationData.fileName,
		generateExcelContent(
			exportationData.columns,
			exportationData.rows
		)
	)
}

function download(filename, text) {
	var element = document.createElement('a');

	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	element.setAttribute('download', filename);
	element.style.display = 'none';
	document.body.appendChild(element);
	
	element.click();
	
	document.body.removeChild(element);
}

function generateExcelContent(columns, rows) {
	var _excelText = (
		[
			'<?xml version="1.0" encoding="utf-8"?>',
			'<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="https://www.w3.org/TR/html401/">',
			'<Worksheet ss:Name="Report">',
			'<Table>',
		].join('')
	);

	_excelText += '<Row>';

	for(var columnName in columns) {
		var _columnData = columns[columnName];

		if(_columnData.label != null) {
			_excelText += '<Cell><Data ss:Type="String">'+ _columnData.label +'</Data></Cell>';
		}                       
	}

	_excelText += '</Row>';

	rows.forEach(function (row) {
		_excelText += '<Row>';

		for(var columnName in columns) {
			var _columnData = columns[columnName];

			if(_columnData.label != null) {
				var _cellValue = row[columnName];

				if(_cellValue == null) {
					_cellValue = '';
				}

				if(typeof(_cellValue) == 'number') {
					_excelText += '<Cell><Data ss:Type="Number">'+ _cellValue +'</Data></Cell>';
				} else {
					_excelText += '<Cell><Data ss:Type="String">'+ _cellValue +'</Data></Cell>';
				}
			}
		}

		_excelText += '</Row>';
	});

	_excelText += '</Table></Worksheet></Workbook>';

	return _excelText;
}

function generateCSVDownload(exportationData) {
	download(
		exportationData.fileName,
		generateCSVContent(
			exportationData.columns,
			exportationData.rows
		)
	)
}

function generateCSVContent(columns, rows) {
	let _columns = [];

	for(var columnName in columns) {
		var _columnData = columns[columnName];

		if(_columnData.label != null) {
			_columns.push(_columnData.label);
		}
	}

	let _csvRowsContent = rows.map(function (row) {
		let _rowValues = [];

		for(var columnName in columns) {
			var _columnData = columns[columnName];

			if(_columnData.label != null) {
				_rowValues.push(row[columnName]);
			}
		}

		return _rowValues.join(';')
	}).join('\n');

	return (
		[
			_columns.join(';'),
			_csvRowsContent
		].join('\n')
	);
}