import traverse from "@babel/traverse";
import { Identifier, isArrayExpression, isIdentifier, isObjectExpression, isObjectProperty, isStringLiteral, ObjectProperty, StringLiteral } from '@babel/types';
import { toValidXtypeProperty as toXtypeProperty } from './astUtil';


export interface IComponentInfo {
    componentClass: string;
    xtypes: string[];
    requires: string[];
}
export function parseXtypes(ast: import('@babel/types').File) {
    const xtypes = new Set<string>();
    traverse(ast, {
        ObjectProperty(path) {
            const node = toXtypeProperty(path.node);
            if (!node) {
                return;
            }
            xtypes.add(node.value.value);
        }
    });
    return xtypes;
}

export async function parseExtJsFile(ast: import('@babel/types').File) {
    const components: IComponentInfo[] = [];
    traverse(ast, {
        CallExpression(path) {
            const callee = path.node.callee,
                args = path.node.arguments;

            if (callee.type === 'MemberExpression') {
                if (callee.object.type === 'Identifier' && callee.object.name === 'Ext') {
                    if ((callee.property as Identifier).name === 'define') {

                        if (isStringLiteral(args[0]) && isObjectExpression(args[1])) {
                            const componentInfo: IComponentInfo = {
                                componentClass: args[0].value,
                                xtypes: [],
                                requires: [],
                            };
                            components.push(componentInfo);
                            const propertyRequires = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === 'requires');
                            const propertyAlias = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === 'alias');
                            const propertyXtype = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === 'xtype');
                            if (isObjectProperty(propertyRequires)) {
                                componentInfo.requires = parseRequires(propertyRequires);
                            }

                            if (isObjectProperty(propertyAlias)) {
                                componentInfo.xtypes.push(...parseXtype(propertyAlias));
                            }
                            if (isObjectProperty(propertyXtype)) {
                                componentInfo.xtypes.push(...parseXtype(propertyXtype));
                            }
                        }
                    }
                }
            }
        }
    });
    return components;
}

function parseRequires(propertyRequires: ObjectProperty) {
    const requires: string[] = [];
    if (isArrayExpression(propertyRequires.value)) {
        propertyRequires.value.elements
            .reduce<string[]>((p, it) => {
                if (it?.type === 'StringLiteral') {
                    p.push(it.value);
                }
                return p;
            }, requires);
    }
    return requires;
}

function parseXtype(propertyAlias: ObjectProperty) {
    const xtypes: string[] = [];

    const aliasNodes: StringLiteral[] = [];
    if (isStringLiteral(propertyAlias.value)) {
        aliasNodes.push(propertyAlias.value);
    }
    if (isArrayExpression(propertyAlias.value)) {
        propertyAlias.value.elements.forEach(it => {
            if (isStringLiteral(it)) {
                aliasNodes.push(it);
            }
        });
    }
    aliasNodes.forEach(it => {
        const propertyValue = it.value;
        const propertyName = isIdentifier(propertyAlias.key) ? propertyAlias.key.name : undefined;
        switch (propertyName) {
            case 'xtype':
                xtypes.push(propertyValue);
                break;
            case 'alias':
                const m = propertyValue.match(/(.+)\.(.+)/);
                if (m) {
                    const [_, namespace, name] = m;
                    switch (namespace) {
                        case 'widget':
                            xtypes.push(name);
                            break;
                        default:
                            break;
                    }
                }
                break;

            default:
                break;
        }
    });

    return xtypes;
}

