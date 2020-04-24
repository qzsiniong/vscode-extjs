import { CancellationToken, DefinitionProvider, ExtensionContext, languages, Location, LocationLink, Position, ProviderResult, Range, TextDocument, Uri } from 'vscode';
import { cmpClassToFsPath, getCmp } from '../utils/xtypeIndexManager';

class XtypeDefinitionProvider implements DefinitionProvider {
	provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]> {
		const range = document.getWordRangeAtPosition(position);
		if (range === undefined) {
			return;
		}
		const line = position.line;
		const xtype = document.getText(range);
		const text = document.getText(new Range(new Position(line, 0), new Position(line, range.end.character + 1)));

		if (new RegExp(`xtype\\s*:\\s*(['"])${xtype}\\1$`).test(text)) {
			const cmpClass = getCmp(xtype);
			if (cmpClass) {
				const fsPath = cmpClassToFsPath(cmpClass);
				const uri = Uri.parse(`file://${fsPath}`);
				const start = new Position(0, 0);
				const end = new Position(0, 0);
				const range = new Range(start, end);

				return {
					uri,
					range
				};
			}
		}
	}


}

export default function registerXtypeDefinitionProvider(context: ExtensionContext) {
	context.subscriptions.push(languages.registerDefinitionProvider('javascript', new XtypeDefinitionProvider()));
}