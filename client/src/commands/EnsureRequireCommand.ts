import json5 from 'json5';
import * as vscode from 'vscode';
import { isNeedRequire } from '../utils/common';
import { getExtjsComponentClass } from '../utils/ExtjsLanguageManager';
import ServerRequest, { toVscodeRange } from "../utils/ServerRequest";

function registerEnsureRequireCommand(context: vscode.ExtensionContext, serverRequest: ServerRequest) {
	const command = vscode.commands.registerCommand('vscode-extjs:ensure-require', async () => {
		const document = vscode.window.activeTextEditor?.document;
		if (!document) {
			return;
		}
		const text = document.getText();

		const components = await serverRequest.parseExtJsFile(text);

		const workspaceEdit = new vscode.WorkspaceEdit();

		components?.forEach(component => {
			const { componentClass, requires, widgets, xtypes } = component;
			const componentClasses = new Set<string>();
			xtypes.forEach(x => {
				const c = getExtjsComponentClass(x.value);
				if (c !== undefined && isNeedRequire(c)) {
					componentClasses.add(c);
				}
			});

			if (componentClasses.size > 0) {
				if (requires) {
					const _requires = requires.value
						.filter(it => isNeedRequire(it))
						.concat(Array.from(componentClasses))
						.sort();
					
					const range = toVscodeRange(requires.start, requires.end);
					workspaceEdit.replace(document.uri, range, 'requires: ' + json5.stringify(Array.from(new Set(_requires))));
					
				}
				
			}
		});

		vscode.workspace.applyEdit(workspaceEdit);
	});
	context.subscriptions.push(command);
}

export default registerEnsureRequireCommand;