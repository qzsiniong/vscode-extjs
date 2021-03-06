import { CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position, ProviderResult, Range, TextDocument } from 'vscode';
import { getExtjsComponentClass } from '../utils/ExtjsLanguageManager';

class XtypeHoverProvider implements HoverProvider {
	provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
		const range = document.getWordRangeAtPosition(position);
		if (range === undefined) {
			return;
		}
		const line = position.line;

		const xtype = document.getText(range);
		const text = document.getText(new Range(new Position(line, 0), new Position(line, range.end.character + 1)));

		if (new RegExp(`xtype\\s*:\\s*(['"])${xtype}\\1$`).test(text)) {
			const cmpClass = getExtjsComponentClass(xtype);
			if (cmpClass) {
				return new Hover(`* **class**: ${cmpClass} \n* **xtype**: ${xtype}`);
			}
		}

		return undefined;
	}

}

export default function registerXtypeHoverProvider(context: ExtensionContext) {
	context.subscriptions.push(languages.registerHoverProvider('javascript', new XtypeHoverProvider()));
}