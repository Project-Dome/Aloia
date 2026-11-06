/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author RSMBR - Isaac Façanha de Carvalho
 */
 define(
    [
        'N/xml',
        '../pd_cnt_common/pd-cntc-common.util.js'
    ],
    function(xml) {
        function xmlToJSON(options) {
            validateOptions(options);

            var _jsonObject = {};

            options.xml = options.xml.replace(/\n/g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><');

            var _xmlElements = xml.XPath.select({
                node: xml.Parser.fromString(options.xml),
                xpath: '/*'
            });
            
            if(_xmlElements.length > 0) {
                var _rootElement = _xmlElements[0];

                _jsonObject[_rootElement.nodeName] = xmlNodeToJson(_rootElement);
            } else {
                throw '"'+ this.xmlString +'" is not a valid xml string!';
            }

            return _jsonObject;

            function xmlNodeToJson(xmlNode) {
                var _jsonNode = null;
                
                if(xmlNode != null) {
                    var _attributes = xmlNode.attributes;
                    var _childs = xmlNode.childNodes;

                    var _counter = {
                        'attributes': 0,
                        'childs': 0
                    };

                    if(_attributes != null || _childs != null) {
                        _jsonNode = {};

                        if(_attributes != null) {
                            for(var attr in _attributes) {
                                if(!isNullOrEmpty(attr)) {
                                    var _attrObject = xmlNode.attributes[attr];
                                    
                                    if(!isNullOrEmpty(_attrObject.name)) {
                                        _jsonNode[_attrObject.name] = (
                                            _attrObject.name.toLowerCase() == 'list'
                                                ? _attrObject.value.split(',').filter(function(listItem) { return !isNullOrEmpty(listItem); })
                                                : _attrObject.value
                                        );
    
                                        _counter['attributes'] += 1;
                                    }
                                }                                
                            }
                        }    
    
                        if(_childs != null) {
                            for(var nodeIndex in _childs) {
                                var _childElement = _childs[nodeIndex];
                                var _childName = _childElement.nodeName;
                                var _childNodeType = _childElement.nodeType;

                                if(!isNullOrEmpty(_childName)) {
                                    if(_jsonNode[_childName] == null) {
                                        _jsonNode[_childName] = [];
                                    }

                                    if(_childNodeType.replace(/\s+/g, '').toLowerCase().anyOf(['cdata_section_node', 'text_node'])) {
                                        _jsonNode = _childElement.textContent;
                                    } else {
                                        var _childNodeValue = xmlNodeToJson(_childElement);
                                        
                                        if(typeof(_childNodeValue) == 'string') {
                                            _jsonNode[_childName] = (isNullOrEmpty(_childNodeValue) ? null : _childNodeValue);
                                        } else {
                                            var _nullChild = (
                                                    _childNodeValue != null
                                                &&  parseBoolean(_childNodeValue['i:nil'])
                                            );

                                            if(isNullOrEmpty(_childNodeValue) || _nullChild) {
                                                if(_jsonNode[_childName].length <= 0) {
                                                    _jsonNode[_childName] = null;
                                                }
                                            } else {
                                                _jsonNode[_childName].push(_childNodeValue);
                                            }                                         
                                        }

                                        _counter['childs'] += 1;
                                    }
                                }
                            }
                        }
                    }

                    if(_counter['childs'] == 0 && _counter['attributes'] == 0) {
                        _jsonNode = xmlNode.textContent;
                    }
                }

                return _jsonNode;
            }

            function validateOptions(options) {
                if(options != null) {
                    if(options.xml != null) {
                        if(type(options.xml) != 'string') {
                            throw '"xml" attribute must be a xml string!';
                        }
                    } else {
                        throw 'Missing "xml" attribute!';
                    }
                } else {
                    throw 'Missing "options" parameter!';
                }
            }
        }

        return {
            xmlToJSON: xmlToJSON
        };
    }
)