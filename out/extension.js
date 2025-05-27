"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const commands_1 = require("./commands");
const highlighter_1 = require("./highlighter");
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // console.log('插件启动中')
    (0, commands_1.activateCommands)(context);
    (0, highlighter_1.activateHighlighter)(context);
    // console.log('插件启动完毕')
}
// This method is called when your extension is deactivated
function deactivate() {
    // console.log('deactivate!')
}
//# sourceMappingURL=extension.js.map