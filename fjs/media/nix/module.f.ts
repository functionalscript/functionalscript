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
import { includes } from '../../types/array/module.f.ts'
import { contains } from '../../types/range/module.f.ts'
import {
    digitRange,
    latinCapitalLetterRange,
    latinSmallLetterRange,
} from '../../text/ascii/module.f.ts'

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

const reservedWords = [
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
] as const

const isReservedWord = includes(reservedWords)

const isUpperLetter = contains(...latinCapitalLetterRange)

const isLowerLetter = contains(...latinSmallLetterRange)

const isAsciiLetter = (character: string): boolean => {
    const c = character.charCodeAt(0)
    return isUpperLetter(c) || isLowerLetter(c)
}

const isDigitN = contains(...digitRange)

const isDigit = (character: string): boolean =>
    isDigitN(character.charCodeAt(0))

const isIdentifierInitial = (character: string): boolean =>
    isAsciiLetter(character) || character === '_'

const isIdentifierTrailing = (character: string): boolean =>
    isIdentifierInitial(character) || isDigit(character) || character === "'" || character === '-'

const isIdentifier = (value: string): boolean => {
    const [initial, ...trailing] = value
    return initial !== undefined
        && isIdentifierInitial(initial)
        && trailing.every(isIdentifierTrailing)
        && !isReservedWord(value)
}

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

type Chunks = readonly string[]

const serializeReference = ([, name, ...selection]: Reference): string | undefined =>
    isIdentifier(name)
        ? [name, ...selection.map(attributeName)].join('.')
        : undefined

const serializeReferenceChunks = (reference: Reference): Chunks | undefined => {
    const serialized = serializeReference(reference)
    return serialized === undefined ? undefined : [serialized]
}

const serializePattern = ([, ...names]: OpenSetPattern): string | undefined =>
    names.every(isIdentifier) ? `{ ${[...names, '...'].join(', ')} }` : undefined

const joinChunks = (chunks: readonly Chunks[], separator: string): Chunks =>
    chunks.flatMap((chunk, index) => index === 0 ? chunk : [separator, ...chunk])

const serializeBindings = (bindings: readonly Binding[], level: number): Chunks | undefined => {
    const serialized = bindings.map(([, path, value]) => {
        const expression = serialize(value, level)
        return expression === undefined
            ? undefined
            : [indent(level), attributePath(path), ' = ', ...expression, ';']
    })
    const defined = serialized.flatMap(value => value === undefined ? [] : [value])
    return defined.length !== serialized.length
        ? undefined
        : joinChunks(defined, '\n')
}

const serializeSet = ([, ...bindings]: AttributeSet, level: number): Chunks | undefined => {
    if (bindings.length === 0) {
        return ['{}']
    }
    const body = serializeBindings(bindings, level + 1)
    return body === undefined ? undefined : ['{\n', ...body, '\n', indent(level), '}']
}

const serializeList = ([, ...references]: NixList): Chunks | undefined => {
    const items = references.map(serializeReference)
    const definedItems = items.flatMap(item => item === undefined ? [] : [item])
    return items.includes(undefined)
        ? undefined
        : items.length === 0
            ? ['[ ]']
            : ['[ ', ...definedItems.flatMap((item, index) => index === 0 ? [item] : [' ', item]), ' ]']
}

const serializeApplication = ([, fn, ...args]: Application, level: number): Chunks | undefined => {
    const serializedFn = serializeReference(fn)
    const serializedArgs = args.map(argument =>
        argument[0] === 'ref'
            ? serializeReferenceChunks(argument)
            : serializeSet(argument, level))
    const definedArgs = serializedArgs.flatMap(argument => argument === undefined ? [] : [argument])
    return serializedFn === undefined || definedArgs.length !== serializedArgs.length
        ? undefined
        : [serializedFn, ...definedArgs.flatMap(argument => [' ', ...argument])]
}

const serializeLambda = ([, pattern, body]: Lambda, level: number): Chunks | undefined => {
    const serializedPattern = serializePattern(pattern)
    const serializedBody = serialize(body, level)
    return serializedPattern === undefined || serializedBody === undefined
        ? undefined
        : [serializedPattern, ': ', ...serializedBody]
}

const serializeLet = ([, bindings, body]: Let, level: number): Chunks | undefined => {
    const serializedBindings = serializeBindings(bindings, level + 1)
    const serializedBody = serialize(body, level)
    return serializedBindings === undefined || serializedBody === undefined
        ? undefined
        : ['let\n', ...serializedBindings, '\n', indent(level), 'in\n', indent(level), ...serializedBody]
}

const serialize = (expression: Expression, level: number): Chunks | undefined => {
    if (typeof expression === 'string') {
        return [quoted(expression)]
    }
    switch (expression[0]) {
        case 'ref': {
            return serializeReferenceChunks(expression)
        }
        case 'set': return serializeSet(expression, level)
        case 'list': return serializeList(expression)
        case 'apply': return serializeApplication(expression, level)
        case 'lambda': return serializeLambda(expression, level)
        case 'let': return serializeLet(expression, level)
        case 'indented-string': {
            const [, value] = expression
            const contentIndent = indent(level + 1)
            const content = escapeIndented(value)
                .split('\n')
                .map(line => `${contentIndent}${line}`)
                .join('\n')
            return ["''\n", content, '\n', indent(level), "''"]
        }
    }
}

/** Serializes an expression into composable chunks, or rejects an invalid identifier. */
export const nix = (expression: Expression): ChunkList<string> | undefined => {
    return serialize(expression, 0)
}

/** Serializes an expression with exactly one trailing newline on success. */
export const nixToString = (expression: Expression): string | undefined => {
    const chunks = nix(expression)
    return chunks === undefined ? undefined : `${concat(chunks)}\n`
}
