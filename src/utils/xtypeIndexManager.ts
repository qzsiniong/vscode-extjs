import * as babelParser from '@babel/parser';
import traverse from "@babel/traverse";
import * as fs from 'fs';
import * as json5 from 'json5';
import * as path from 'path';
import * as vscode from 'vscode';
import { sourceLocationToRange } from './astUtil';
import { isNeedRequire } from './common';
import { parseExtJsFile } from './parseExtJsFile';


const conf: IConf = {
    extjsDir: '',
    extjsBase: '',
    workspaceRoot: '',
};

interface IConf {
    extjsDir: string;
    extjsBase: string;
    workspaceRoot: string;
}

async function initConfig() {
    const confUris = await vscode.workspace.findFiles('extjs.conf.json');
    for (const uri of confUris) {
        const fileSystemPath = uri.fsPath || uri.path;
        const confJson = fs.readFileSync(fileSystemPath, 'utf8');
        const _conf = json5.parse(confJson);
        Object.assign(conf, _conf);
    }
}

const cmpToXtypesMapping: { [cmp: string]: string[] | null; } = {};
export const xtypeToCmpMapping: { [xtype: string]: string } = {};

const cmpToRequiresMapping: { [cmp: string]: string[] | null; } = {};

export function fsPathToCmpClass(fsPath: string) {
    const wsf = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(fsPath));
    if (wsf) {
        if (conf.workspaceRoot === '') {
            conf.workspaceRoot = wsf.uri.fsPath;
        }
        fsPath = fsPath.replace(wsf.uri.fsPath, '');
    }
    fsPath = fsPath.replace(new RegExp(`^${path.sep}*${conf.extjsDir}${path.sep}*`), '');
    fsPath = fsPath.replace(/\..+$/, '');
    return conf.extjsBase + '.' + fsPath.split(path.sep).join('.');
}

export function cmpClassToFsPath(cmpClass: string) {
    let fsPath = conf.extjsDir + cmpClass.replace(/\./g, path.sep).replace(new RegExp(`^${conf.extjsBase}`), '') + '.js';
    fsPath = path.join(conf.workspaceRoot, vscode.workspace.asRelativePath(fsPath));
    return fsPath;
}

async function indexing(text: string) {
    const ast = babelParser.parse(text);
    const components = await parseExtJsFile(ast);

    components.forEach(cmp=>{
        const {componentClass, requires, xtypes} = cmp;
        cmpToXtypesMapping[componentClass] = xtypes;

        xtypes.forEach(xtype => {
            xtypeToCmpMapping[xtype] = componentClass;
        });

        cmpToRequiresMapping[componentClass] = requires;
    });
}

function handleDeleFile(fsPath: string) {
    const cmp = fsPathToCmpClass(fsPath);

    getXtypes(cmp)?.forEach(xtype => {
        delete xtypeToCmpMapping[xtype];
    });

    delete cmpToXtypesMapping[cmp];
    delete cmpToRequiresMapping[cmp];
}

export function getXtypes(cmp: string) {
    return cmpToXtypesMapping[cmp];
}

export function getRequiredXtypes(cmp: string) {
    const requires = Object.keys(cmpToXtypesMapping).filter(it=>!isNeedRequire(it));
    requires.push(...(cmpToRequiresMapping[cmp]|| []));
    return requires.reduce<string[]>((previousValue, currentCmpClass) => {
        previousValue.push(...(getXtypes(currentCmpClass) || []));
        return previousValue;
    }, []);
}

export function getCmp(xtype: string) {
    return xtypeToCmpMapping[xtype];
}


async function indexingXtype() {
    const uris = await vscode.workspace.findFiles(`${conf.extjsDir}/**/*.js`);

    for (const uri of uris) {
        const text = (await vscode.workspace.fs.readFile(uri)).toString();
        await indexing(text);
    }
}

const diagnosticCollection = vscode.languages.createDiagnosticCollection('extjs-lint');

async function validateExtjsDocument(textDocument: vscode.TextDocument): Promise<void> {
    const cmpClass = fsPathToCmpClass(textDocument.uri.fsPath);
    // The validator creates diagnostics for all uppercase words length 2 and more
    const text = textDocument.getText();

    const requiredXtypes = getRequiredXtypes(cmpClass) || [];

    let problems = 0;
    let diagnostics: vscode.Diagnostic[] = [];


    function validateXtype(xtype: string, range: vscode.Range) {
        if (!requiredXtypes.includes(xtype)) {
            // problems++;
            let diagnostic: vscode.Diagnostic = {
                severity: vscode.DiagnosticSeverity.Error,
                range,
                message: `xtype "${xtype}" 对应的组件未引入.`,
                source: 'vscode-extjs'
            };
            diagnostics.push(diagnostic);
        }
    }

    try {
        // @babel/parser
        const ast = babelParser.parse(text);
        traverse(ast, {
            Identifier(path) {
                const parent = path.parent;
                if (parent.type === 'ObjectProperty' && path.node.name === 'xtype') {
                    if (parent.value.type === 'StringLiteral') {
                        const xtype = parent.value.value,
                            range = sourceLocationToRange(parent.value.loc!);
                        validateXtype(xtype, range);
                    }
                }
            }
        });
    } catch (error) {
        // SyntaxError
    }

    diagnosticCollection.set(textDocument.uri, diagnostics);
}

export async function initXtypesIndexing(context: vscode.ExtensionContext) {
    await initConfig();
    await indexingXtype();

    const activeTextDocument = vscode.window.activeTextEditor?.document;
    if (activeTextDocument && activeTextDocument.languageId === 'javascript') {
        await validateExtjsDocument(activeTextDocument);
    }

    const confWatcher = vscode.workspace.createFileSystemWatcher('extjs.conf.json');
    context.subscriptions.push(confWatcher);
    confWatcher.onDidChange(initConfig);

    vscode.workspace.onDidChangeTextDocument(async (event) => {
        // TODO debounce 去抖动,防止快速输入

        const textDocument = event.document;

        if (textDocument.languageId === 'javascript') {
            const fsPath = textDocument.uri.fsPath;
            await handleDeleFile(fsPath);
            await indexing(textDocument.getText());

            await validateExtjsDocument(textDocument);
        }
    }, context.subscriptions);

    vscode.workspace.onDidDeleteFiles(async (event) => {
        event.files.forEach(async file => {
            await handleDeleFile(file.fsPath);

            // TODO activeDocument Validating
            const activeTextDocument = vscode.window.activeTextEditor?.document;
            if (activeTextDocument && activeTextDocument.languageId === 'javascript') {
                await validateExtjsDocument(activeTextDocument);
            }
        });
    }, context.subscriptions);

    vscode.window.onDidChangeActiveTextEditor(async (e: vscode.TextEditor | undefined) => {
        const textDocument = e?.document;
        if (textDocument) {
            if (textDocument.languageId === 'javascript') {
                await validateExtjsDocument(textDocument);
            }
        }
    }, context.subscriptions);

    vscode.workspace.onDidOpenTextDocument(async (textDocument: vscode.TextDocument) => {
        if (textDocument.languageId === 'javascript') {
            await validateExtjsDocument(textDocument);
        }
    }, context.subscriptions);

}