import { ExtensionContext } from 'vscode';
import registerXtypeDefinitionProvider from './XtypeDefinionProvider';
import registerXtypeHoverProvider from './XtypeHoverProvider';

export function registerProviders(context: ExtensionContext) {
	registerXtypeHoverProvider(context);
	registerXtypeDefinitionProvider(context);
}