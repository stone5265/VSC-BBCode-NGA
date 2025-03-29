// extension.ts
import * as vscode from 'vscode';
import TextmateLanguageService from 'vscode-textmate-languageservice';

const NGA_DOMAIN = "(?:bbs\\.nga\\.cn|ngabbs\\.com|nga\\.178\\.com)";
const { getScopeInformationAtPosition } = TextmateLanguageService.api;

export function activateCommands(context: vscode.ExtensionContext) {
    // console.log('正在注册命令');
    // 注册命令
    context.subscriptions.push(
        vscode.commands.registerCommand('bbcode-nga.toggleBold', toggleBoldCommand),
        vscode.commands.registerCommand('bbcode-nga.toggleUnderline', toggleUnderlineCommand),
        vscode.commands.registerCommand('bbcode-nga.toggleItalic', toggleItalicCommand),
        vscode.commands.registerCommand('bbcode-nga.toggleQuote', toggleQuoteCommand),
        vscode.commands.registerCommand('bbcode-nga.decode', decodeCommand),
        vscode.commands.registerCommand('bbcode-nga.condenseUrl', condenseUrlCommand)
    );
    // console.log('命令注册完毕');
}

async function toggle(tag: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const startTag = `[${tag}]`;
    const endTag = `[/${tag}]`;

    const originalState = editor.selections.map(selection => ({
        startOffset: editor.document.offsetAt(selection.start),
        endOffset: editor.document.offsetAt(selection.end)
      }));
    const bias: number[] = [];

    await editor.edit(editBuilder => {
        editor.selections.forEach(selection => {
            const selectionStartOffset = editor.document.offsetAt(selection.start);
            const selectionEndOffset = editor.document.offsetAt(selection.end);

            // 检查所选区域前后是否存在tag
            const startCheckRange = new vscode.Range(
                editor.document.positionAt(selectionStartOffset - startTag.length),
                selection.start
            );
            const endCheckRange = new vscode.Range(
                selection.end,
                editor.document.positionAt(selectionEndOffset + endTag.length)
            );

            const existStart = editor.document.getText(startCheckRange) === startTag;
            const existEnd = editor.document.getText(endCheckRange) === endTag;

            if (existStart && existEnd) {
                // 移除代码块
                editBuilder.delete(startCheckRange);
                editBuilder.delete(endCheckRange);
                bias.push(-startTag.length)
            } else {
                // 添加代码块
                editBuilder.insert(selection.start, startTag);
                editBuilder.insert(selection.end, endTag);
                bias.push(startTag.length)
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
        } else {
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
    if (!editor) return;

    const edit = new vscode.WorkspaceEdit();
    const pattern = '\\['

    const processSelection = async (selection: vscode.Selection) => {
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
        const selection = new vscode.Selection(new vscode.Position(0, 0), editor.document.positionAt(editor.document.getText().length))
        await processSelection(selection);
    } else {
        await Promise.all(Array.from(editor.selections).map(processSelection));
    }
    
    await vscode.workspace.applyEdit(edit);

}

async function condenseUrlCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const edit = new vscode.WorkspaceEdit();
    const pattern = `(?:https://)?${NGA_DOMAIN}/`

    const processSelection = async (selection: vscode.Selection) => {
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
        await processSelection(
            new vscode.Selection(
                new vscode.Position(0, 0),
                editor.document.positionAt(editor.document.getText().length))
        );
    } else {
        await Promise.all(Array.from(editor.selections).map(processSelection));
    }
    
    await vscode.workspace.applyEdit(edit);
}
