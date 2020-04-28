import { isArrayExpression, isIdentifier, isStringLiteral, ObjectProperty, SourceLocation, StringLiteral } from '@babel/types';
import * as vscode from 'vscode';

function sourceLocationToRange(loc: SourceLocation) {
    const start = new vscode.Position(loc.start.line - 1, loc.start.column),
        end = new vscode.Position(loc.end.line - 1, loc.end.column);
    return new vscode.Range(start, end);
}

function sourcePositionToPosition(position: SourceLocation['start']) {
    return new vscode.Position(position.line - 1, position.column);
}

type ValidRequiresObjectProperty =
	Omit<ObjectProperty, 'value' | 'key'>
	& { key: { name: 'requires' } }
	& { value: { elements: Array<StringLiteral>,loc: SourceLocation | null; } };

function toValidRequiresProperty(node: ObjectProperty): ValidRequiresObjectProperty | undefined {
	if (!isIdentifier(node.key)) { return; }

	if (node.key.name !== 'requires') { return; }

	if (!isArrayExpression(node.value)) { return; }

	if (node.value.elements === null) {
		return;
	}

	for (const item of node.value.elements) {
		if (item === null) {
			return;
		}

		if (!isStringLiteral(item)) {

			return;
		}
	}
	return node as ValidRequiresObjectProperty;
}


type ValidXtypeObjectProperty =
	Omit<ObjectProperty, 'value' | 'key'>
	& { key: { name: 'xtype' } }
	& { value: { value: string,loc: SourceLocation | null; } };

function toValidXtypeProperty(node: ObjectProperty): ValidXtypeObjectProperty | undefined {
	if (!isIdentifier(node.key)) { return; }

	if (node.key.name !== 'xtype') { return; }

	if (!isStringLiteral(node.value)) { return; }
	
	return node as ValidXtypeObjectProperty;
}

export { sourceLocationToRange, sourcePositionToPosition, toValidRequiresProperty, toValidXtypeProperty };

