import * as vscode from 'vscode';
import { CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, CompletionList, ExtensionContext, languages, Position, ProviderResult, TextDocument } from 'vscode';
import { widgetToComponentClassMapping } from '../utils/ExtjsLanguageManager';

class XtypeCompletionItemProvider implements CompletionItemProvider {
	provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList> {
		const completionItems:ProviderResult<CompletionItem[] | CompletionList> = [];
		// const simpleCompletion = new vscode.CompletionItem('Hello World!');
		// completionItems.push(simpleCompletion);

		Object.keys(widgetToComponentClassMapping).forEach(xtype=>{
			const xtypeCompletion = new vscode.CompletionItem(`xtype: ${xtype}`);
			xtypeCompletion.insertText = `xtype: "${xtype}",`;
			xtypeCompletion.command = {command: 'vscode-extjs:ensure-require', title: 'ensure-require'};
			completionItems.push(xtypeCompletion);
		});

		return completionItems;
	}

}

function registerXtypeCompletionItemProvider(context: ExtensionContext) {
	context.subscriptions.push(languages.registerCompletionItemProvider('javascript', new XtypeCompletionItemProvider()));
}

export default registerXtypeCompletionItemProvider;