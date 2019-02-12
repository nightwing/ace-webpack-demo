

self.process = {env: {}}
global = window = self

var cssLanguageService = require("vscode-css-languageservice");
var jsonLanguageService = require("vscode-json-languageservice");
var htmlLanguageService = require("vscode-html-languageservice");
var yamlLanguageService = require("yaml-language-server/out/server/src/languageservice/yamlLanguageService.js");

importScripts(require("file-loader!ace-builds/src-noconflict/worker-json.js"));

function LspAdapter(ctx, createData) {
    this._ctx = ctx;
    this._languageSettings = createData.languageSettings;
    this._languageId = createData.languageId;
    this._languageService = ctx.service.getLanguageService({});
    this._languageService.configure(this._languageSettings);
}
(function () {
    this.doValidation = function (uri) {
        var document = this._getTextDocument(uri);
        if (!document)
            return Promise.resolve([]);
        
        var jsonDocument = this._languageService.parseJSONDocument(document);
        return this._languageService.doValidation(document, jsonDocument).then(function(annotations) {
            return annotations.map(toAceAnnotation);
        });
    };
    this.doComplete = function (uri, position) {
        var document = this._getTextDocument(uri);
        var jsonDocument = this._languageService.parseJSONDocument(document);
        return this._languageService.doComplete(document, position, jsonDocument).then(function(result) {
            return result.items.map(toAceCompletion);
        });
    };
    this.doResolve = function (item) {
        return this._languageService.doResolve(item);
    };
    this.doHover = function (uri, position) {
        var document = this._getTextDocument(uri);
        var jsonDocument = this._languageService.parseJSONDocument(document);
        return this._languageService.doHover(document, position, jsonDocument);
    };
    this.format = function (uri, range, options) {
        var document = this._getTextDocument(uri);
        var textEdits = this._languageService.format(document, range, options);
        return Promise.resolve(textEdits);
    };
    this.resetSchema = function (uri) {
        return Promise.as(this._languageService.resetSchema(uri));
    };
    this.findDocumentSymbols = function (uri) {
        var document = this._getTextDocument(uri);
        var jsonDocument = this._languageService.parseJSONDocument(document);
        var symbols = this._languageService.findDocumentSymbols(document, jsonDocument);
        return Promise.as(symbols);
    };
    this.findDocumentColors = function (uri) {
        var document = this._getTextDocument(uri);
        var stylesheet = this._languageService.parseJSONDocument(document);
        var colorSymbols = this._languageService.findDocumentColors(document, stylesheet);
        return Promise.as(colorSymbols);
    };
    this.getColorPresentations = function (uri, color, range) {
        var document = this._getTextDocument(uri);
        var stylesheet = this._languageService.parseJSONDocument(document);
        var colorPresentations = this._languageService.getColorPresentations(document, stylesheet, color, range);
        return Promise.as(colorPresentations);
    };
    this.provideFoldingRanges = function (uri, context) {
        var document = this._getTextDocument(uri);
        var ranges = this._languageService.getFoldingRanges(document, context);
        return Promise.as(ranges);
    };
    this._getTextDocument = function (uri) {
        if (this.doc) return this.doc;
        var doc = this._ctx.doc;
        this.doc = {}
        this.doc.offsetAt = function(pos) {
            return doc.positionToIndex(toAcePosition(pos))
        }
        this.doc.positionAt = function(offset) {
            return toLspPosition(doc.indexToPosition(offset))
        }
        this.doc.getText = function() {
            return doc.getValue()
        }
        return this.doc; 
    };
}).call(LspAdapter.prototype);


function toLspPosition(pos) {
    return {line: pos.row, character: pos.column}
}
function toAcePosition(pos) {
    return {row: pos.line, column: pos.character}
}
function toAceCompletion(item) {
    var transformed = {
        score: 1000,
        caption: item.label,
        doc: item.documentation || item.detail,
        command: item.command
    }
    if (item.insertTextFormat == 2)
        transformed.snippet = item.insertText
    else
        transformed.value = item.insertText
    // todo: handle filterText, textEdit
    return transformed;
}
function toAceAnnotation(m) {
    var start = toAcePosition(m.range.start);
    var end = toAcePosition(m.range.end);
    return {
        text: m.message,
        code: m.code,
        type: ["", "error", "warning", "info"][m.severity],
        row: start.row, 
        column: start.column,
    };
}

ace.define('ace/worker/my-worker',[], function(require, exports, module) {
    "use strict";

    var oop = require("ace/lib/oop");
    var Mirror = require("ace/worker/mirror").Mirror;

    var MyWorker = function(sender) {
        Mirror.call(this, sender);
        this.setTimeout(200);
                
        this.json = new LspAdapter({
            service: jsonLanguageService,
            doc: this.doc
        }, {languageSettings:{
            validate: true,
            allowComments: true,
            schemas: [{
                uri: "http://myserver/foo-schema.json", // id of the first schema
                fileMatch: [""], // associate with our model
                schema: {
                    type: "object",
                    properties: {
                        "$1 $2": { enum: ["v1", "v2"] },
                        p1: {
                            enum: ["v1", "v2"]
                        },
                        p2: {
                            $ref: "http://myserver/bar-schema.json" // reference the second schema
                        }
                    }
                }
            }, {
                uri: "http://myserver/bar-schema.json", // id of the first schema
                schema: {
                    type: "object",
                    properties: {
                        q1: {
                            enum: ["x1", "x2"]
                        }
                    }
                }
            }]
        }, languageId: "jsonc"});
    };

    oop.inherits(MyWorker, Mirror);

    (function() {
        this.onUpdate = function() {
            var sender = this.sender;
            this.json.doValidation().then(function(annotations) {
                sender.emit("annotate", annotations);
            }).catch(function() {
                debugger
            })
            // debugger
            // jsonLanguageService
            // var annotations = validate(value);
            // 
            this.format()
        };
        this.format = function(uri, range, options) {
            this.json.format(uri, range, options).then(function(messages) {
            //     debugger
            })
        }
        this.doComplete = function(uri, position, callbackId) {
            var sender = this.sender;
            this.json.doComplete(uri, toLspPosition(position)).then(function(result) {
                sender.callback(result, callbackId);
            })
        }
    }).call(MyWorker.prototype);

    exports.MyWorker = MyWorker;
});

window.onmessage({
    data: {
        init : true,
        module: 'ace/worker/my-worker',
        classname : "MyWorker"
    }
});

