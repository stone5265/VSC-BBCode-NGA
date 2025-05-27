// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { activateCommands} from './commands'
import { activateHighlighter } from './highlighter'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// console.log('插件启动中')
	
	activateCommands(context)
	activateHighlighter(context)

	// console.log('插件启动完毕')
}

// This method is called when your extension is deactivated
export function deactivate() {
	// console.log('deactivate!')
}