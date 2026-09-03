/**
 * A minimal, checked eDSL for constructing and serializing Nix expressions.
 *
 * The tree deliberately models syntax rather than evaluated Nix values. String
 * expressions are escaped double-quoted strings; the other supported forms are
 * represented by tagged tuples. See `./types.ts` for the `Expression`
 * type-level API.
 *
 * @module
 *
 * @import { List as ChunkList } from '../../types/list/types.ts'
 * @import { Expression, _AttributePath, _Binding, _Reference, _AttributeSet, _NixList, _Application, _OpenSetPattern, _Lambda, _Let, _Chunks } from './types.ts'
 */

import { concat } from '../../types/string/module.f.mjs'
import { includes } from '../../types/array/module.f.mjs'
import {
    digitRange,
    latinCapitalLetterRange,
    latinSmallLetterRange,
    range,
} from '../../text/ascii/module.f.mjs'
import { contains, fromRange, union } from '../../types/range_set/module.f.mjs'

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

const letters = union
    (fromRange(latinCapitalLetterRange))
    (fromRange(latinSmallLetterRange))

const identifierInitial = union
    (letters)
    (fromRange(range('_')))

const containsIdentifierInitial = contains(identifierInitial)

/** @type {(character: string) => boolean} */
const isIdentifierInitial = character =>
    containsIdentifierInitial(character.charCodeAt(0))

const identifierTrailing = union
    (union
        (identifierInitial)
        (fromRange(digitRange)))
    (union
        (fromRange(range("'")))
        (fromRange(range('-'))))

const containsIdentifierTrailing = contains(identifierTrailing)

/** @type {(character: string) => boolean} */
const isIdentifierTrailing = character =>
    containsIdentifierTrailing(character.charCodeAt(0))

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

/**
 * The content of an indented string, escaped so Nix reads back what went in.
 *
 * Two characters are dangerous, and only in company. `''` closes the string or
 * begins an escape, and `${` opens an interpolation; everything else is
 * literal, which the lexer's catch-all rule
 * `([^\$\']|\$[^\{\']|\'[^\'\$])+` says outright.
 *
 * So **every** `'` is written `''\'` — the escape whose value is one quote —
 * rather than pairs being written `'''`. That looks like more work than the job
 * needs, and it is what makes the job possible: an escape begins with `''`, so
 * a bare `'` left in front of one would join it. `'` before `${` used to emit
 * `'''${`, and the lexer takes `'''` as an escaped `''` and then reads the
 * `${` as a *live* interpolation. Escaping every quote means no bare one is
 * ever adjacent to an escape, and the collision cannot arise.
 *
 * A `$` is escaped only where it can open an interpolation, which is directly
 * before a `{`. Elsewhere it is already literal — `$PATH` reads as `$PATH` —
 * and escaping it would be noise in a file people read.
 *
 * @type {(value: string) => string}
 */
const escapeIndented = value => value
    .replaceAll("'", "''\\'")
    .replaceAll('${', "''${")

/**
 * The one `$` `escapeIndented` cannot see: the last character of a string part,
 * when a reference follows it.
 *
 * The `{` that makes it dangerous belongs to the next part — a reference is
 * written `${a.b}` — so `['$', ['ref', 'a']]` emitted `$${a}`, and the lexer's
 * catch-all matches `$$` and runs on through `{a}` as one literal token. The
 * interpolation is not a live one and not a literal `${a}` either; it is the
 * text `$${a}`, with the reference silently gone.
 *
 * `escapeIndented`'s output ends in `$` exactly when its input did: the `''$`
 * escape is always followed by the `{` that provoked it, and the `''\'` escape
 * ends in a quote.
 *
 * @type {(escaped: string) => string}
 */
const escapeTrailingDollar = escaped =>
    escaped.endsWith('$') ? `${escaped.slice(0, -1)}''$` : escaped

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

/**
 * Adjacent string parts joined into one, so escaping sees the text a reader
 * sees rather than each half of it.
 *
 * Escaping part by part is wrong in both directions, and silently. `'$'`
 * followed by `'{x}'` has no `${` in either half, so neither is escaped and the
 * two concatenate into an interpolation Nix resolves. Worse, `"a'"` followed by
 * `"'b"` has no `''` in either half either, and the pair closes the string: the
 * file that comes out is not Nix at all.
 *
 * A reference between two strings is a real boundary — nothing can be
 * synthesised across an interpolation — so only runs of strings are joined.
 *
 * @type {(parts: readonly (string | _Reference)[]) => readonly (string | _Reference)[]}
 */
const coalesceStrings = parts => parts.reduce(
    /** @type {(acc: readonly (string | _Reference)[], part: string | _Reference) => readonly (string | _Reference)[]} */
    (acc, part) => {
        const last = acc[acc.length - 1]
        return typeof part === 'string' && typeof last === 'string'
            ? [...acc.slice(0, -1), `${last}${part}`]
            : [...acc, part]
    },
    [])

/**
 * One part of an indented string: content, or an interpolation.
 *
 * Escaping is what separates them. A `string` is content, so `${` in it becomes
 * `''${` and reaches the file as those two characters; a `_Reference` is
 * written as `${a.b}` unescaped, which is the form Nix resolves. That is the
 * whole of the distinction, and it is why a hook that needs a store path takes
 * a reference rather than a string spelling one.
 *
 * A string part is told whether a reference follows it, because that is the
 * one thing its own text cannot say — see {@link escapeTrailingDollar}.
 *
 * `undefined` for a reference whose root is not an identifier, as everywhere
 * else — the caller propagates it.
 *
 * @type {(part: string | _Reference, referenceFollows: boolean) => string | undefined}
 */
const indentedPart = (part, referenceFollows) => {
    if (typeof part === 'string') {
        const escaped = escapeIndented(part)
        return referenceFollows ? escapeTrailingDollar(escaped) : escaped
    }
    const reference = serializeReference(part)
    return reference === undefined ? undefined : `\${${reference}}`
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

/** @type {(item: _Reference | string) => string | undefined} */
const serializeListItem = item =>
    typeof item === 'string' ? quoted(item) : serializeReference(item)

/** @type {(list: _NixList) => _Chunks | undefined} */
const serializeList = ([, ...references]) => {
    const items = references.map(serializeListItem)
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
            const [, ...parts] = expression
            const coalesced = coalesceStrings(parts)
            const serialized = coalesced.map((part, index) =>
                indentedPart(part, typeof coalesced[index + 1] !== 'string'
                    && coalesced[index + 1] !== undefined))
            const defined = serialized.flatMap(part => part === undefined ? [] : [part])
            if (defined.length !== serialized.length) { return undefined }
            const contentIndent = indent(level + 1)
            const content = defined.join('')
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
