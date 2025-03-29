"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateCommands = activateCommands;
// extension.ts
const vscode = __importStar(require("vscode"));
const vscode_textmate_languageservice_1 = __importDefault(require("vscode-textmate-languageservice"));
const NGA_DOMAIN = "(?:bbs\\.nga\\.cn|ngabbs\\.com|nga\\.178\\.com)";
const { getScopeInformationAtPosition } = vscode_textmate_languageservice_1.default.api;
function activateCommands(context) {
    // console.log('正在注册命令');
    // 注册命令
    context.subscriptions.push(vscode.commands.registerCommand('bbcode-nga.toggleBold', toggleBoldCommand), vscode.commands.registerCommand('bbcode-nga.toggleUnderline', toggleUnderlineCommand), vscode.commands.registerCommand('bbcode-nga.toggleItalic', toggleItalicCommand), vscode.commands.registerCommand('bbcode-nga.toggleQuote', toggleQuoteCommand), vscode.commands.registerCommand('bbcode-nga.decode', decodeCommand), vscode.commands.registerCommand('bbcode-nga.condenseUrl', condenseUrlCommand));
    // console.log('命令注册完毕');
}
async function toggle(tag) {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const startTag = `[${tag}]`;
    const endTag = `[/${tag}]`;
    const originalState = editor.selections.map(selection => ({
        startOffset: editor.document.offsetAt(selection.start),
        endOffset: editor.document.offsetAt(selection.end)
    }));
    const bias = [];
    await editor.edit(editBuilder => {
        editor.selections.forEach(selection => {
            const selectionStartOffset = editor.document.offsetAt(selection.start);
            const selectionEndOffset = editor.document.offsetAt(selection.end);
            // 检查所选区域前后是否存在tag
            const startCheckRange = new vscode.Range(editor.document.positionAt(selectionStartOffset - startTag.length), selection.start);
            const endCheckRange = new vscode.Range(selection.end, editor.document.positionAt(selectionEndOffset + endTag.length));
            const existStart = editor.document.getText(startCheckRange) === startTag;
            const existEnd = editor.document.getText(endCheckRange) === endTag;
            if (existStart && existEnd) {
                // 移除代码块
                editBuilder.delete(startCheckRange);
                editBuilder.delete(endCheckRange);
                bias.push(-startTag.length);
            }
            else {
                // 添加代码块
                editBuilder.insert(selection.start, startTag);
                editBuilder.insert(selection.end, endTag);
                bias.push(startTag.length);
            }
        });
    });
    // 重新选择区域
    let biasTotal = 0;
    editor.selections = originalState.map((state, i) => {
        const start = editor.document.positionAt(state.startOffset + bias[i] + biasTotal);
        const end = editor.document.positionAt(state.endOffset + bias[i] + biasTotal);
        if (bias[i] > 0) {
            biasTotal += bias[i] * 2 + 1;
        }
        else {
            biasTotal += bias[i] * 2 - 1;
        }
        return new vscode.Selection(start, end);
    });
}
function toggleBoldCommand() {
    return toggle('b');
}
function toggleUnderlineCommand() {
    return toggle('u');
}
function toggleItalicCommand() {
    return toggle('i');
}
function toggleQuoteCommand() {
    return toggle('quote');
}
// async function selectionReplace(selection: vscode.Selection, document: vscode.TextDocument, edit: vscode.WorkspaceEdit,
//     pattern: string, targetScope: string, newText: string) {
//     const text = document.getText(selection);
//     const regex = new RegExp(pattern, 'g');
//     const selectionStartOffset = document.offsetAt(selection.start);
//     let match;
//     while (match = regex.exec(text)) {
//         const matchStart = selectionStartOffset + match.index;
//         const startPosition = document.positionAt(matchStart);
//         const token = await getScopeInformationAtPosition(document, startPosition);
//         if (token.type.includes(targetScope)) {
//             const matchEnd = matchStart + match[0].length;
//             const endPosition = document.positionAt(matchEnd);
//             edit.replace(document.uri, new vscode.Range(startPosition, endPosition), newText);
//         }
//     }
// };
async function decodeCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const edit = new vscode.WorkspaceEdit();
    const pattern = '\\[';
    const processSelection = async (selection) => {
        const text = editor.document.getText(selection);
        const regex = new RegExp(pattern, 'g');
        const selectionStartOffset = editor.document.offsetAt(selection.start);
        let match;
        while (match = regex.exec(text)) {
            const matchStart = selectionStartOffset + match.index;
            const startPosition = editor.document.positionAt(matchStart);
            const token = await getScopeInformationAtPosition(editor.document, startPosition);
            // 将[tag]...[/tag]变为[[size=0%][/size]tag]...[[size=0%][/size]/tag]
            if (token.type.includes('tag.bbcode.nga')) {
                const matchEnd = matchStart + match[0].length;
                const endPosition = editor.document.positionAt(matchEnd);
                edit.replace(editor.document.uri, new vscode.Range(startPosition, endPosition), '[[size=0%][/size]');
            }
        }
    };
    // 若没选中内容, 则默认对全文进行操作
    if (editor.selections.length == 1 && editor.selection.isEmpty) {
        const selection = new vscode.Selection(new vscode.Position(0, 0), editor.document.positionAt(editor.document.getText().length));
        await processSelection(selection);
    }
    else {
        await Promise.all(Array.from(editor.selections).map(processSelection));
    }
    await vscode.workspace.applyEdit(edit);
}
async function condenseUrlCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const edit = new vscode.WorkspaceEdit();
    const pattern = `(?:https://)?${NGA_DOMAIN}/`;
    const processSelection = async (selection) => {
        const text = editor.document.getText(selection);
        const regex = new RegExp(pattern, 'g');
        const selectionStartOffset = editor.document.offsetAt(selection.start);
        let match;
        while (match = regex.exec(text)) {
            const matchStart = selectionStartOffset + match.index;
            const startPosition = editor.document.positionAt(matchStart);
            const token = await getScopeInformationAtPosition(editor.document, startPosition);
            // 将URL中的NGA域名精简成/
            if (token.type.includes('link')) {
                const matchEnd = matchStart + match[0].length;
                const endPosition = editor.document.positionAt(matchEnd);
                edit.replace(editor.document.uri, new vscode.Range(startPosition, endPosition), '/');
            }
        }
    };
    // 若没选中内容, 则默认对全文进行操作
    if (editor.selections.length == 1 && editor.selection.isEmpty) {
        await processSelection(new vscode.Selection(new vscode.Position(0, 0), editor.document.positionAt(editor.document.getText().length)));
    }
    else {
        await Promise.all(Array.from(editor.selections).map(processSelection));
    }
    await vscode.workspace.applyEdit(edit);
}
//# sourceMappingURL=commands.js.map