var ace = require("ace-builds")
require("ace-builds/webpack-resolver");
require("ace-builds/src-noconflict/mode-json");
require("ace-builds/src-noconflict/ext-language_tools");

var Worker = require('worker-loader!./my-worker.js');



ace.define('ace/mode/my-mode',[], function(require, exports, module) {
    var oop = require("ace/lib/oop");
    var JsonMode = require("ace/mode/json").Mode;
    var JsonHighlightRules = require("ace/mode/json_highlight_rules").JsonHighlightRules;
 
    var MyHighlightRules = function() {
        JsonHighlightRules.call(this)
        var keywordMapper = this.createKeywordMapper({
            "keyword.control": "if|then|else",
            "keyword.operator": "and|or|not",
            "keyword.other": "class",
            "storage.type": "int|float|text",
            "storage.modifier": "private|public",
            "support.function": "print|sort",
            "constant.language": "true|false"
        }, "identifier");
        this.$rules.start.push(
            {
                token : "comment",
                regex : "\\/\\/.*$"
            },{
                token : "comment", // multi line comment
                regex : "\\/\\*",
                next : [
                    {
                        token : "comment", // closing comment
                        regex : "\\*\\/",
                        next : "start"
                    }, {
                        defaultToken : "comment"
                    }
                ]
            }
        );
        this.normalizeRules();
    };
    oop.inherits(MyHighlightRules, JsonHighlightRules);

    var MyMode = function() {
        JsonMode.call(this);
        this.HighlightRules = MyHighlightRules;
    };
    oop.inherits(MyMode, JsonMode);

    (function() {

        this.$id = "ace/mode/my-mode";
        
        var WorkerClient = require("ace/worker/worker_client").WorkerClient;
        
        this.createWorker = function(session) {
            this.$worker = new WorkerClient(new Worker());
            this.$worker.attachToDocument(session.getDocument());

            this.$worker.on("errors", function(e) {
                session.setAnnotations(e.data);
            });

            this.$worker.on("annotate", function(e) {
                session.setAnnotations(e.data);
            });

            this.$worker.on("terminate", function() {
                session.clearAnnotations();
            });

            return this.$worker;
        };
        
        this.getCompletions = function(state, session, pos, prefix) {
            this.$worker.call("doComplete", [session.doc.id, pos], function() {
                
            });
        };
        
        this.completer = {
            getCompletions: function(editor, session, pos, prefix, callback) {
                if (!session.$worker)
                    return callback();
                session.$worker.call("doComplete", [session.doc.id, pos], function(data) {
                    callback(null, data)
                });
                // session.$worker.emit("complete", { data: { pos: pos, prefix: prefix } });
                // session.$worker.on("complete", function(e){
                    // callback(null, e.data);
                // });
            }
        };
    }).call(MyMode.prototype);

    exports.Mode = MyMode;
});


var editor = ace.edit("editor", {
    enableBasicAutocompletion: true
});
//editor.setTheme("ace/theme/twilight");
editor.session.setMode("ace/mode/my-mode");
var invalidJSON = "// comment\n" + JSON.stringify({x: 1, y: [1, 2, {t: "45"}]}, null, 4).replace(/5/, "\\5");
editor.session.setValue(invalidJSON)


