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
    // console.log('正在注册命令')
    // 注册命令
    context.subscriptions.push(vscode.commands.registerCommand('bbcode-nga.toggleBold', toggleBoldCommand), vscode.commands.registerCommand('bbcode-nga.toggleUnderline', toggleUnderlineCommand), vscode.commands.registerCommand('bbcode-nga.toggleItalic', toggleItalicCommand), vscode.commands.registerCommand('bbcode-nga.toggleQuote', toggleQuoteCommand), vscode.commands.registerCommand('bbcode-nga.decode', decodeCommand), vscode.commands.registerCommand('bbcode-nga.condenseUrl', condenseUrlCommand), vscode.commands.registerCommand('bbcode-nga.replaceImg', replaceImgCommand), vscode.commands.registerCommand('bbcode-nga.tableToMarkdown', tableToMarkdownCommand));
    // console.log('命令注册完毕')
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
//     const text = document.getText(selection)
//     const regex = new RegExp(pattern, 'g')
//     const selectionStartOffset = document.offsetAt(selection.start)
//     let match
//     while (match = regex.exec(text)) {
//         const matchStart = selectionStartOffset + match.index
//         const startPosition = document.positionAt(matchStart)
//         const token = await getScopeInformationAtPosition(document, startPosition)
//         if (token.type.includes(targetScope)) {
//             const matchEnd = matchStart + match[0].length
//             const endPosition = document.positionAt(matchEnd)
//             edit.replace(document.uri, new vscode.Range(startPosition, endPosition), newText)
//         }
//     }
// }
async function decodeCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const edit = new vscode.WorkspaceEdit();
    const pattern = '\\[';
    const processSelection = async (selection) => {
        const content = editor.document.getText(selection);
        const regex = new RegExp(pattern, 'g');
        const selectionStartOffset = editor.document.offsetAt(selection.start);
        let match;
        while (match = regex.exec(content)) {
            const matchStart = selectionStartOffset + match.index;
            const startPosition = editor.document.positionAt(matchStart);
            const token = await getScopeInformationAtPosition(editor.document, startPosition);
            // 将"[tag]...[/tag]"变为"[[size=0%][/size]tag]...[[size=0%][/size]/tag]"
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
    const pattern = `(?:https://)?(${NGA_DOMAIN}/)|(www.bilibili.com/[^\\[\\]\s]+)`;
    const processSelection = async (selection) => {
        const content = editor.document.getText(selection);
        const regex = new RegExp(pattern, 'g');
        const selectionStartOffset = editor.document.offsetAt(selection.start);
        let match;
        while (match = regex.exec(content)) {
            const matchStart = selectionStartOffset + match.index;
            const startPosition = editor.document.positionAt(matchStart);
            const token = await getScopeInformationAtPosition(editor.document, startPosition);
            // 将URL中的NGA域名精简成"/", B站链接去掉"?"之后的内容
            if (token.type.includes('link')) {
                const matchEnd = matchStart + match[0].length;
                const endPosition = editor.document.positionAt(matchEnd);
                const range = new vscode.Range(startPosition, endPosition);
                const url = editor.document.getText(range);
                if (url.includes('bilibili')) {
                    edit.replace(editor.document.uri, range, url.split('?')[0]);
                }
                else {
                    edit.replace(editor.document.uri, range, '/');
                }
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
async function replaceImgCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const edit = new vscode.WorkspaceEdit();
    const pattern = `\\[img\\](.+?)\\[/img\\]`;
    const processSelection = async (selection) => {
        const content = editor.document.getText(selection);
        const regex = new RegExp(pattern, 'g');
        const selectionStartOffset = editor.document.offsetAt(selection.start);
        let match;
        while (match = regex.exec(content)) {
            const matchStart = selectionStartOffset + match.index;
            const startPosition = editor.document.positionAt(matchStart);
            const token = await getScopeInformationAtPosition(editor.document, startPosition);
            // 将"[img]...[/img]"变为"__图__"
            if (token.type.includes('img.tag.bbcode.nga')) {
                const matchEnd = matchStart + match[0].length;
                const endPosition = editor.document.positionAt(matchEnd);
                edit.replace(editor.document.uri, new vscode.Range(startPosition, endPosition), '__图__');
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
const NGA_HOSTING = 'https://bbs.nga.cn';
const NGA_IMAGE_HOSTING = 'https://img.nga.178.com/attachments';
const BBCODE2MD = {
    'b': '**',
    'i': '*',
    'del': '~~',
    'code': '`'
};
function _getDisplayWidth(text) {
    let width = 0;
    for (let char of text) {
        const code = char.codePointAt(0) || 0;
        if ((0x4E00 <= code && code <= 0x9FFF) || // CJK统一表意文字
            (0x3040 <= code && code <= 0x309F) || // 平假名
            (0x30A0 <= code && code <= 0x30FF) || // 片假名
            (0xFF00 <= code && code <= 0xFFEF) // 全角符号
        ) {
            width += 2;
        }
        else {
            width += 1;
        }
    }
    return width;
}
function _fillUrl(url, img = false) {
    if (img) {
        // 若NGA图床为相对路径(默认), 则填充为完整路径
        return url[0] === '.' ? NGA_IMAGE_HOSTING + url.substring(1) : url;
    }
    else {
        // 若url为精简过NGA域名的链接, 则填充上NGA域名
        return url[0] === '/' ? NGA_HOSTING + url : url;
    }
}
class MarkdownTable {
    startPosition;
    endPosition = null;
    rows = [];
    lenCols = {};
    row = [];
    cell = '';
    curCol = 0;
    buffer = {};
    constructor(startPosition) {
        this.startPosition = startPosition;
    }
    get nCols() {
        return Object.keys(this.lenCols).length > 0 ? Math.max(...Object.keys(this.lenCols).map(Number)) : 0;
    }
    newRow() {
        this.row = [];
        this.curCol = 0;
    }
    newCol() {
        this.newCell();
        ++this.curCol;
    }
    newCell() {
        this.cell = '';
    }
    updateRow() {
        this.rows.push(this.row);
    }
    updateCol() {
        this.cell = this.cell.replace(/\r?\n|\r/g, '<br>');
        this.row.push(this.cell);
        this.lenCols[this.curCol] = Math.max(this.lenCols[this.curCol] || 0, _getDisplayWidth(this.cell));
    }
    updateCell(text, tag = '') {
        if (tag === 'tr') {
            this.updateRow();
        }
        else if (tag === 'td') {
            this.cell += text;
            this.updateCol();
        }
        else if (tag === 'url') {
            // "[url]链接[/url]"变为"链接", "[url=链接]描述[/url]"变为"[描述](链接)"
            if (this.buffer['url']) {
                const caption = text;
                const url = _fillUrl(this.buffer['url']);
                this.cell += `[${caption}](${url})`;
            }
            else {
                const url = _fillUrl(text);
                this.cell += url;
            }
            this.buffer['url'] = null;
        }
        else if (tag === 'img') {
            const imgUrl = _fillUrl(text, true);
            this.cell += `![IMG](${imgUrl})`;
        }
        else {
            this.cell += (BBCODE2MD[tag] || '') + text + (BBCODE2MD[tag] || '');
        }
    }
    build(endPosition) {
        this.endPosition = endPosition;
        let filledRows = [];
        for (let row of this.rows) {
            // 填充缺少的列
            row = row.concat(Array(this.nCols - row.length).fill(''));
            // 填充单元格, 使得每个单元格长度一样 (中文占两个显示宽度, 需要手动处理)
            row = row.map((cell, i) => {
                const displayWidth = _getDisplayWidth(cell);
                const padding = this.lenCols[i + 1] - displayWidth + cell.length;
                return cell.padEnd(padding);
            });
            // 转为字符串
            filledRows.push('| ' + row.join(' | ') + ' |');
        }
        // 添加分隔行
        const splitRow = '| ' + Array(this.nCols).fill('').map((_, i) => {
            const width = this.lenCols[i + 1] || 3;
            return ':' + '-'.repeat(width - 1);
        }).join(' | ') + ' |';
        filledRows.splice(1, 0, splitRow);
        // 转为字符串
        return filledRows.join('\n');
    }
}
async function tableToMarkdownCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const edit = new vscode.WorkspaceEdit();
    const pattern = /\[(\/)?([^=\[\] \d]+|\*)(\d+| [^\[\]]+|=[^\]]+)?\]/g;
    const processSelection = async (selection) => {
        const content = editor.document.getText(selection);
        const regex = new RegExp(pattern, 'g');
        const selectionStartOffset = editor.document.offsetAt(selection.start);
        let tagStack = [];
        const dumTable = new MarkdownTable(selection.start);
        let mdTable = dumTable;
        let lastPosition = 0;
        let match;
        while (match = regex.exec(content)) {
            const [fullMatch, isEnd, tag, suffix] = match;
            const matchStart = selectionStartOffset + match.index;
            const matchEnd = matchStart + fullMatch.length;
            const startPosition = editor.document.positionAt(matchStart);
            const endPosition = editor.document.positionAt(matchEnd);
            const token = await getScopeInformationAtPosition(editor.document, startPosition);
            if (!token.type.includes('tag.bbcode.nga')) {
                continue;
            }
            // 跳过表格外部区域
            if (mdTable === dumTable && tag !== 'table' && !isEnd) {
                continue;
            }
            // 跳过不支持转换的BBCode
            if (!['table', 'tr', 'td', 'b', 'i', 'del', 'code', 'url', 'img'].includes(tag)) {
                if (mdTable !== dumTable) {
                    const text = content.substring(lastPosition, match.index);
                    mdTable.updateCell(text);
                }
                lastPosition = match.index + fullMatch.length;
                continue;
            }
            if (!isEnd) {
                // 开头tag
                if (tag === 'table') {
                    if (mdTable !== dumTable) {
                        //不支持嵌套表格
                        break;
                    }
                    // 表格初始化
                    mdTable = new MarkdownTable(startPosition);
                }
                else if (tag === 'tr') {
                    mdTable.newRow();
                }
                else if (tag === 'td') {
                    mdTable.newCol();
                }
                else if (tag === 'url' && suffix) {
                    mdTable.buffer['url'] = suffix.substring(1);
                }
                tagStack.push(tag);
            }
            else {
                // 结尾tag
                if (tagStack.length > 0 && tagStack.pop() === tag) {
                    const text = content.substring(lastPosition, match.index);
                    if (tag === 'table') {
                        // 生成markdown格式的表格
                        const replaceStr = mdTable.build(endPosition);
                        edit.replace(editor.document.uri, new vscode.Range(mdTable.startPosition, endPosition), replaceStr);
                        mdTable = dumTable;
                    }
                    else {
                        mdTable.updateCell(text, tag);
                    }
                }
                else {
                    // 检测到未闭合/不当闭合顺序代码块
                    break;
                }
            }
            // 跳过BBCode tag
            lastPosition = match.index + fullMatch.length;
        }
    };
    await Promise.all(Array.from(editor.selections).map(processSelection));
    await vscode.workspace.applyEdit(edit);
}
//# sourceMappingURL=commands.js.map