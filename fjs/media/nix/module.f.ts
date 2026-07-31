/**
 * A minimal, checked eDSL for constructing and serializing Nix expressions.
 *
 * The tree deliberately models syntax rather than evaluated Nix values. String
 * expressions are escaped double-quoted strings; the other supported forms are
 * represented by tagged tuples.
 *
 * @module
 */
import { type List as ChunkList } from '../../types/list/module.f.ts'
import { concat } from '../../types/string/module.f.ts'

type Identifier = string

type AttributeName = string

type AttributePath = readonly [AttributeName, ...AttributeName[]]

type Binding = readonly ['=', AttributePath, Expression]

type Reference = readonly ['ref', Identifier, ...AttributeName[]]

type AttributeSet = readonly ['set', ...Binding[]]

type NixList = readonly ['list', ...Reference[]]

type ApplicationArgument = Reference | AttributeSet

type Application = readonly ['apply', Reference, ...ApplicationArgument[]]

type OpenSetPattern = readonly ['open-set-pattern', ...Identifier[]]

type Lambda = readonly ['lambda', OpenSetPattern, Expression]

type Let = readonly ['let', readonly Binding[], Expression]

type IndentedString = readonly ['indented-string', string]

/** The Nix syntax supported by the serializer. */
export type Expression =
    | string
    | Reference
    | AttributeSet
    | NixList
    | Application
    | Lambda
    | Let
    | IndentedString

const reservedWords: ReadonlySet<string> = new Set([
    'assert',
    'else',
    'if',
    'in',
    'inherit',
    'let',
    'or',
    'rec',
    'then',
    'with',
] as const)

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_'-]*$/

const isIdentifier = (value: string): boolean =>
    identifierPattern.test(value) && !reservedWords.has(value)

const indent = (level: number): string => '    '.repeat(level)

const escapeQuoted = (value: string): string => value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('${', '\\${')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')

const quoted = (value: string): string => `"${escapeQuoted(value)}"`

const attributeName = (value: AttributeName): string =>
    isIdentifier(value) ? value : quoted(value)

const attributePath = (path: AttributePath): string =>
    path.map(attributeName).join('.')

const escapeIndented = (value: string): string => value
    .replaceAll("''", "'''")
    .replaceAll('${', "''${")

const serializeReference = ([, name, ...selection]: Reference): string | undefined =>
    isIdentifier(name)
        ? [name, ...selection.map(attributeName)].join('.')
        : undefined

const serializePattern = ([, ...names]: OpenSetPattern): string | undefined =>
    names.every(isIdentifier) ? `{ ${[...names, '...'].join(', ')} }` : undefined

const serializeBindings = (bindings: readonly Binding[], level: number): string | undefined => {
    const serialized = bindings.map(([, path, value]) => {
        const expression = serialize(value, level)
        return expression === undefined
            ? undefined
            : `${indent(level)}${attributePath(path)} = ${expression};`
    })
    return serialized.includes(undefined) ? undefined : serialized.join('\n')
}

const serializeSet = ([, ...bindings]: AttributeSet, level: number): string | undefined => {
    if (bindings.length === 0) {
        return '{}'
    }
    const body = serializeBindings(bindings, level + 1)
    return body === undefined ? undefined : `{\n${body}\n${indent(level)}}`
}

const serializeList = ([, ...references]: NixList): string | undefined => {
    const items = references.map(serializeReference)
    return items.includes(undefined) ? undefined : items.length === 0 ? '[ ]' : `[ ${items.join(' ')} ]`
}

const serializeApplication = ([, fn, ...args]: Application, level: number): string | undefined => {
    const serializedFn = serializeReference(fn)
    const serializedArgs = args.map(argument =>
        argument[0] === 'ref' ? serializeReference(argument) : serializeSet(argument, level))
    return serializedFn === undefined || serializedArgs.includes(undefined)
        ? undefined
        : [serializedFn, ...serializedArgs].join(' ')
}

const serializeLambda = ([, pattern, body]: Lambda, level: number): string | undefined => {
    const serializedPattern = serializePattern(pattern)
    const serializedBody = serialize(body, level)
    return serializedPattern === undefined || serializedBody === undefined
        ? undefined
        : `${serializedPattern}: ${serializedBody}`
}

const serializeLet = ([, bindings, body]: Let, level: number): string | undefined => {
    const serializedBindings = serializeBindings(bindings, level + 1)
    const serializedBody = serialize(body, level)
    return serializedBindings === undefined || serializedBody === undefined
        ? undefined
        : `let\n${serializedBindings}\n${indent(level)}in\n${indent(level)}${serializedBody}`
}

const serialize = (expression: Expression, level: number): string | undefined => {
    if (typeof expression === 'string') {
        return quoted(expression)
    }
    switch (expression[0]) {
        case 'ref': return serializeReference(expression)
        case 'set': return serializeSet(expression, level)
        case 'list': return serializeList(expression)
        case 'apply': return serializeApplication(expression, level)
        case 'lambda': return serializeLambda(expression, level)
        case 'let': return serializeLet(expression, level)
        case 'indented-string': {
            const contentIndent = indent(level + 1)
            const content = escapeIndented(expression[1])
                .split('\n')
                .map(line => `${contentIndent}${line}`)
                .join('\n')
            return `''\n${content}\n${indent(level)}''`
        }
    }
}

/** Serializes an expression into composable chunks, or rejects an invalid identifier. */
export const nix = (expression: Expression): ChunkList<string> | undefined => {
    const value = serialize(expression, 0)
    return value === undefined ? undefined : [value]
}

/** Serializes an expression with exactly one trailing newline on success. */
export const nixToString = (expression: Expression): string | undefined => {
    const chunks = nix(expression)
    return chunks === undefined ? undefined : `${concat(chunks)}\n`
}
