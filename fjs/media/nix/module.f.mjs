/**
 * A minimal, checked eDSL for constructing and serializing Nix expressions.
 *
 * The tree deliberately models syntax rather than evaluated Nix values. String
 * expressions are escaped double-quoted strings; the other supported forms are
 * represented by tagged tuples. See `./types.ts` for the `Expression`
 * type-level API.
 *
 * @module
 */
/** @import { List as ChunkList } from '../../types/list/types.ts' */
import { toArray } from '../../types/list/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { includes } from '../../types/array/module.f.mjs'
import {
    digitRange,
    latinCapitalLetterRange,
    latinSmallLetterRange,
    range,
} from '../../text/ascii/module.f.mjs'
import { fromRange, get, merge } from '../../types/range_set/module.f.mjs'
/** @import { Expression, _AttributePath, _Binding, _Reference, _AttributeSet, _NixList, _Application, _OpenSetPattern, _Lambda, _Let, _Chunks } from './types.ts' */

const reservedWords = /** @type {const} */ ([
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
])

const isReservedWord = includes(reservedWords)

const letters = merge
    (fromRange(latinCapitalLetterRange))
    (fromRange(latinSmallLetterRange))

const identifierInitial = toArray(merge
    (letters)
    (fromRange(range('_'))))

const getIdentifierInitial = get(identifierInitial)

/** @type {(character: string) => boolean} */
const isIdentifierInitial = character =>
    getIdentifierInitial(character.charCodeAt(0))

const identifierTrailing = toArray(merge
    (merge
        (identifierInitial)
        (fromRange(digitRange)))
    (merge
        (fromRange(range("'")))
        (fromRange(range('-')))))

const getIdentifierTrailing = get(identifierTrailing)

/** @type {(character: string) => boolean} */
const isIdentifierTrailing = character =>
    getIdentifierTrailing(character.charCodeAt(0))

/** @type {(value: string) => boolean} */
const isIdentifier = value => {
    const [initial, ...trailing] = value
    return initial !== undefined
        && isIdentifierInitial(initial)
        && trailing.every(isIdentifierTrailing)
        && !isReservedWord(value)
}

/** @type {(level: number) => string} */
const indent = level => '    '.repeat(level)

/** @type {(value: string) => string} */
const escapeQuoted = value => value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('${', '\\${')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')

/** @type {(value: string) => string} */
const quoted = value => `"${escapeQuoted(value)}"`

/** @type {(value: string) => string} */
const attributeName = value =>
    isIdentifier(value) ? value : quoted(value)

/** @type {(path: _AttributePath) => string} */
const attributePath = path =>
    path.map(attributeName).join('.')

/** @type {(value: string) => string} */
const escapeIndented = value => value
    .replaceAll("''", "'''")
    .replaceAll('${', "''${")

/** @type {(line: string) => string} */
const protectLeadingWhitespace = line => {
    const contentStart = [...line, 'x'].findIndex(character => character !== ' ' && character !== '\t')
    const leading = line.slice(0, contentStart)
        .replaceAll(' ', "''\\ ")
        .replaceAll('\t', "''\\t")
    return `${leading}${line.slice(contentStart)}`
}

/** @type {(reference: _Reference) => string | undefined} */
const serializeReference = ([, name, ...selection]) =>
    isIdentifier(name)
        ? [name, ...selection.map(attributeName)].join('.')
        : undefined

/** @type {(reference: _Reference) => _Chunks | undefined} */
const serializeReferenceChunks = reference => {
    const serialized = serializeReference(reference)
    return serialized === undefined ? undefined : [serialized]
}

/** @type {(pattern: _OpenSetPattern) => string | undefined} */
const serializePattern = ([, ...names]) =>
    names.every((name, index) => isIdentifier(name) && names.indexOf(name) === index)
        ? `{ ${[...names, '...'].join(', ')} }`
        : undefined

/** @type {(chunks: readonly _Chunks[], separator: string) => _Chunks} */
const joinChunks = (chunks, separator) =>
    chunks.flatMap((chunk, index) => index === 0 ? chunk : [separator, ...chunk])

/** @type {(prefix: _AttributePath, path: _AttributePath) => boolean} */
const isPathPrefix = (prefix, path) =>
    prefix.length <= path.length
    && prefix.every((name, index) => name === path[index])

/** @type {(a: _AttributePath, b: _AttributePath) => boolean} */
const pathsConflict = (a, b) =>
    isPathPrefix(a, b) || isPathPrefix(b, a)

/** @type {(bindings: readonly _Binding[]) => boolean} */
const bindingsCompatible = bindings =>
    bindings.every(([, path], index) =>
        bindings.slice(0, index).every(([, previous]) => !pathsConflict(path, previous)))

/** @type {(bindings: readonly _Binding[], level: number) => _Chunks | undefined} */
const serializeBindings = (bindings, level) => {
    if (!bindingsCompatible(bindings)) {
        return undefined
    }
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

/** @type {(set: _AttributeSet, level: number) => _Chunks | undefined} */
const serializeSet = ([, ...bindings], level) => {
    if (bindings.length === 0) {
        return ['{}']
    }
    const body = serializeBindings(bindings, level + 1)
    return body === undefined ? undefined : ['{\n', ...body, '\n', indent(level), '}']
}

/** @type {(list: _NixList) => _Chunks | undefined} */
const serializeList = ([, ...references]) => {
    const items = references.map(serializeReference)
    const definedItems = items.flatMap(item => item === undefined ? [] : [item])
    return items.includes(undefined)
        ? undefined
        : items.length === 0
            ? ['[ ]']
            : ['[ ', ...definedItems.flatMap((item, index) => index === 0 ? [item] : [' ', item]), ' ]']
}

/** @type {(application: _Application, level: number) => _Chunks | undefined} */
const serializeApplication = ([, fn, ...args], level) => {
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

/** @type {(lambda: _Lambda, level: number) => _Chunks | undefined} */
const serializeLambda = ([, pattern, body], level) => {
    const serializedPattern = serializePattern(pattern)
    const serializedBody = serialize(body, level)
    return serializedPattern === undefined || serializedBody === undefined
        ? undefined
        : [serializedPattern, ': ', ...serializedBody]
}

/** @type {(let_: _Let, level: number) => _Chunks | undefined} */
const serializeLet = ([, bindings, body], level) => {
    const serializedBindings = serializeBindings(bindings, level + 1)
    const serializedBody = serialize(body, level)
    return serializedBindings === undefined || serializedBody === undefined
        ? undefined
        : ['let\n', ...serializedBindings, '\n', indent(level), 'in\n', indent(level), ...serializedBody]
}

/** @type {(expression: Expression, level: number) => _Chunks | undefined} */
const serialize = (expression, level) => {
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
                .map(protectLeadingWhitespace)
                .map(line => `${contentIndent}${line}`)
                .join('\n')
            return ["''\n", content, '\n', indent(level), "''"]
        }
    }
}

/**
 * Serializes an expression into composable chunks, or rejects an invalid identifier.
 *
 * @type {(expression: Expression) => ChunkList<string> | undefined}
 */
export const nix = expression => {
    return serialize(expression, 0)
}

/**
 * Serializes an expression with exactly one trailing newline on success.
 *
 * @type {(expression: Expression) => string | undefined}
 */
export const nixToString = expression => {
    const chunks = nix(expression)
    return chunks === undefined ? undefined : `${concat(chunks)}\n`
}
