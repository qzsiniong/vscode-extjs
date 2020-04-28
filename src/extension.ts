// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import registerEnsureRequireCommand from './commands/EnsureRequireCommand';
import { registerProviders } from './providers/ProviderManager';
import { initXtypesIndexing } from './utils/xtypeIndexManager';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "vscode-extjs" is now active!');

	registerEnsureRequireCommand(context);
	// registerFormatRequiresCommand(context);

	initXtypesIndexing(context);

	registerProviders(context);
}

// this method is called when your extension is deactivated
export function deactivate() { }
