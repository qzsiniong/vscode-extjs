import traverse from "@babel/traverse";
import { StringLiteral } from '@babel/types';
import * as vscode from 'vscode';
import { astParse, sourceLocationToRange, toValidRequiresProperty } from '../utils/astUtil';
import { isNeedRequire } from '../utils/common';
import { parseXtypes } from '../utils/parseExtJsFile';
import { xtypeToCmpMapping } from '../utils/xtypeIndexManager';
import json5 = require('json5');

function registerEnsureRequireCommand(context: vscode.ExtensionContext) {
	const command = vscode.commands.registerCommand('vscode-extjs:ensure-require', async () => {
		const document = vscode.window.activeTextEditor?.document;
		if (!document) {
			return;
		}
		const text = document.getText();
		const ast = astParse(text);
		if (ast instanceof SyntaxError) {
			return ;
		}
		const xtypes = await parseXtypes(ast);
		const componentClasses = new Set<string>();
		xtypes.forEach(x => {
			const c = xtypeToCmpMapping[x];
			if (c !== undefined && isNeedRequire(c)) {
				componentClasses.add(c);
			}
		});

		if (componentClasses.size > 0) {
			traverse(ast, {
				ObjectProperty(path) {
					const node = toValidRequiresProperty(path.node);
					if (!node) {
						return;
					}

					if (!node.value.loc) {
						return;
					}

					const requireNodes = node.value.elements;

					const requires = requireNodes
						.map(it => (it as StringLiteral))
						.filter(it => isNeedRequire(it.value))
						.map(it => it.value)
						.concat(Array.from(componentClasses))
						.sort();

					const workspaceEdit = new vscode.WorkspaceEdit();
					const range = sourceLocationToRange(node.value.loc);
					workspaceEdit.replace(document.uri, range, json5.stringify(Array.from(new Set(requires))));
					vscode.workspace.applyEdit(workspaceEdit);
				}
			});
		}
	});
	context.subscriptions.push(command);
}

export default registerEnsureRequireCommand;