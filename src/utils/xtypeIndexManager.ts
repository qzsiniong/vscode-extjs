// import * as babelParser from '@babel/parser';
import * as fs from 'fs';
import * as json5 from 'json5';
import * as path from 'path';
import * as readline from 'readline';
import * as vscode from 'vscode';

const pattern = /\balias\s*:\s*(['"])widget\.([a-zA-Z0-9\-_.]+)\1/;
const patterns = /\balias\s*:\s*(\[\s*(['"])widget\.[a-zA-Z0-9\-_.]+\2(?:\s*,\s*(['"])widget\.[a-zA-Z0-9\-_.]+\3)*\s*,?\s*\])/;
const patternRequires = /\brequires\s*:\s*(\[\s*(['"])[a-zA-Z_0-9\-.]+\2(\s*,\s*(['"])[a-zA-Z_0-9\-.]+\4)*\s*,?\s*\])/;
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

function parseRequires(text: string): string[] | null {
    const m1 = patternRequires.exec(text);
    if (m1) {
        return json5.parse(m1[1]) as string[];
    }
    return null;
}

function parseXtype(text: string) {
    let m = pattern.exec(text);
    if (m) {
        return [m[2]];
    }

    m = patterns.exec(text);
    if (m) {
        const xtypes = json5.parse(m[1]) as string[];
        return xtypes.map(xtype => xtype.replace('widget.', ''));
    }
    return null;
}

async function parseFile(fsPath: string) {
    let xtypes: string[] | null = null;
    let requires: string[] | null = null;
    const lines: string[] = [];
    const rl = readline.createInterface({
        input: fs.createReadStream(fsPath),
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        lines.push(line);
        const text = lines.join('\n');

        if (xtypes === null) {
            xtypes = parseXtype(text);
        }

        if (requires === null) {
            requires = parseRequires(text);
        }

        if (requires !== null && xtypes !== null) {
            rl.close();
            break;
        }
    }
    return {
        xtypes, requires
    };
}

const cmpToXtypesMapping: { [cmp: string]: string[] | null; } = {};
const xtypeToCmpMapping: { [xtype: string]: string } = {};

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

async function indexing(fsPath: string) {
    const { xtypes, requires } = await parseFile(fsPath);
    const cmp = fsPathToCmpClass(fsPath);
    cmpToXtypesMapping[cmp] = xtypes;

    xtypes?.forEach(xtype => {
        xtypeToCmpMapping[xtype] = cmp;
    });

    cmpToRequiresMapping[cmp] = requires;
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
    return cmpToRequiresMapping[cmp]?.reduce<string[]>((previousValue, currentCmpClass) => {
        previousValue.push(...(getXtypes(currentCmpClass) || []));
        return previousValue;
    }, []);
}

export function getCmp(xtype: string) {
    return xtypeToCmpMapping[xtype];
}


async function indexingXtype() {
    const uris = await vscode.workspace.findFiles("extjs-projects/**/*.js");

    uris.forEach(uri => {
        indexing(uri.fsPath);
    });

    for (const uri of uris) {
        await indexing(uri.fsPath);
    }
}

const diagnosticCollection = vscode.languages.createDiagnosticCollection('extjs-lint');

async function validateExtjsDocument(textDocument: vscode.TextDocument): Promise<void> {
    const cmpClass = fsPathToCmpClass(textDocument.uri.fsPath);
    // The validator creates diagnostics for all uppercase words length 2 and more
    const text = textDocument.getText();

    // @babel/parser
    // const f = babelParser.parse(text);


    let pattern = /(\bxtype\s*:\s*(['"]))(\w+)\2/g;
    let m: RegExpExecArray | null;

    const requiredXtypes = getRequiredXtypes(cmpClass) || [];

    let problems = 0;
    let diagnostics: vscode.Diagnostic[] = [];
    while ((m = pattern.exec(text))) {
        const xtype = m[3];
        if (!requiredXtypes.includes(xtype)) {
            problems++;
            let diagnostic: vscode.Diagnostic = {
                severity: vscode.DiagnosticSeverity.Error,
                range: new vscode.Range(
                    textDocument.positionAt(m.index + m[1].length),
                    textDocument.positionAt(m.index + m[1].length + xtype.length),
                ),
                message: `xtype "${xtype}" 对应的组件未引入.`,
                source: 'vscode-extjs'
            };
            diagnostics.push(diagnostic);
        }
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
            await indexing(fsPath);

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

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (e: vscode.TextEditor | undefined) => {
        const textDocument = e?.document;
        if (textDocument) {
            if (textDocument.languageId === 'javascript') {
                await validateExtjsDocument(textDocument);
            }
        }
    }));

    vscode.workspace.onDidOpenTextDocument(async (textDocument: vscode.TextDocument) => {
        if (textDocument.languageId === 'javascript') {
            // const fsPath = textDocument.uri.fsPath;
            // await handleDeleFile(fsPath);
            // await indexing(fsPath);

            await validateExtjsDocument(textDocument);
        }
    }, context.subscriptions);

}