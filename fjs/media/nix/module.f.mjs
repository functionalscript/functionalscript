/**
 * A minimal, checked eDSL for constructing and serializing Nix expressions.
 *
 * The tree deliberately models syntax rather than evaluated Nix values. String
 * expressions are escaped double-quoted strings; the other supported forms are
 * represented by tagged tuples. See `./types.ts` for the `Expression`
 * type-level API.
 *
 * Two passes, one per job. {@link check} decides whether an expression is
 * legal Nix and names the first rule it breaks; {@link serialize} decides what
 * a legal one renders as, and cannot fail.
 *
 * @module
 *
 * @import { List } from '../../types/list/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Range } from '../../types/range/types.ts'
 * @import { RangeSet } from '../../types/range_set/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Expression, _AttributePath, _Binding, _Reference, _AttributeSet, _NixList, _Application, _OpenSetPattern, _Lambda, _Let, _IndentedString } from './types.ts'
 */

import { concat } from '../../types/string/module.f.mjs'
import { includes } from '../../types/array/module.f.mjs'
import { error, mapOk, ok } from '../../types/result/module.f.mjs'
import {
    digitRange,
    latinCapitalLetterRange,
    latinSmallLetterRange,
    range,
} from '../../text/ascii/module.f.mjs'
import { contains, fromRange, union } from '../../types/range_set/module.f.mjs'
import { flat, flatMap, intersperse, map, mergeAdjacent, toArray } from '../../types/list/module.f.mjs'

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

/**
 * The set of an inclusive ASCII range: `text/ascii` spells its ranges by their
 * last character, and a range set's upper boundary is exclusive.
 *
 * @type {(r: Range) => RangeSet}
 */
const asciiSet = ([a, b]) => fromRange([a, b + 1])

const letters = union
    (asciiSet(latinCapitalLetterRange))
    (asciiSet(latinSmallLetterRange))

const identifierInitial = union
    (letters)
    (asciiSet(range('_')))

const containsIdentifierInitial = contains(identifierInitial)

/** @type {(character: string) => boolean} */
const isIdentifierInitial = character =>
    containsIdentifierInitial(character.charCodeAt(0))

const identifierTrailing = union
    (union
        (identifierInitial)
        (asciiSet(digitRange)))
    (union
        (asciiSet(range("'")))
        (asciiSet(range('-'))))

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

/**
 * The first reason `f` gives for any of `items`, or `null` when it gives none.
 *
 * `f` is not called once a reason is found, so nothing after the first
 * reason is checked. The walk is a plain `reduce` rather than a lazy list on
 * purpose: `check` recurses once per level of nesting, and every frame a
 * level costs is depth a legal expression loses before the stack runs out.
 *
 * @type {<T>(f: (item: T, index: number) => Nullable<string>) => (items: readonly T[]) => Nullable<string>}
 */
const firstReasonOf = f => items => items.reduce(
    /** @type {(reason: Nullable<string>, item: typeof items[number], index: number) => Nullable<string>} */
    (reason, item, index) => reason ?? f(item, index),
    null)

/** @type {(reference: _Reference) => Nullable<string>} */
const checkReference = ([, name]) =>
    isIdentifier(name) ? null : `reference root is not an identifier: ${quoted(name)}`

/** @type {(pattern: _OpenSetPattern) => Nullable<string>} */
const checkPattern = ([, ...names]) => firstReasonOf(
    /** @type {(name: string, index: number) => Nullable<string>} */
    (name, index) =>
        !isIdentifier(name) ? `pattern name is not an identifier: ${quoted(name)}`
        : names.indexOf(name) !== index ? `duplicate pattern name: ${name}`
        : null)
    (names)

/** @type {(prefix: _AttributePath, path: _AttributePath) => boolean} */
const isPathPrefix = (prefix, path) =>
    prefix.length <= path.length
    && prefix.every((name, index) => name === path[index])

/** @type {(a: _AttributePath, b: _AttributePath) => boolean} */
const pathsConflict = (a, b) =>
    isPathPrefix(a, b) || isPathPrefix(b, a)

/**
 * The first attribute path in a binding group that is a prefix of an earlier
 * one, or the reverse — Nix rejects `x = …; x.y = …;` as a redefinition.
 *
 * @type {(bindings: readonly _Binding[]) => Nullable<string>}
 */
const checkConflicts = bindings => firstReasonOf(
    /** @type {(binding: _Binding, index: number) => Nullable<string>} */
    ([, path], index) => {
        const previous = bindings.slice(0, index).find(([, p]) => pathsConflict(path, p))
        return previous === undefined
            ? null
            : `conflicting attribute paths: ${attributePath(previous[1])} and ${attributePath(path)}`
    })
    (bindings)

/** @type {(reason: Nullable<string>, binding: _Binding) => Nullable<string>} */
const valueReason = (reason, [, , value]) => reason ?? check(value)

/**
 * A binding group is legal when its paths do not conflict and every value is.
 * The whole group's paths are checked before any value, so a conflict is
 * reported without walking a value on either side of it, however deep.
 *
 * The values are walked by a `reduce` of their own rather than through
 * {@link firstReasonOf}: this is the walk every level of a nested set takes,
 * and the frames it saves are nesting depth.
 *
 * @type {(bindings: readonly _Binding[]) => Nullable<string>}
 */
const checkBindings = bindings =>
    checkConflicts(bindings) ?? bindings.reduce(valueReason, null)

/** @type {(set: _AttributeSet) => Nullable<string>} */
const checkSet = ([, ...bindings]) => checkBindings(bindings)

/** @type {(list: _NixList) => Nullable<string>} */
const checkList = ([, ...items]) => firstReasonOf(check)(items)

/** @type {(application: _Application) => Nullable<string>} */
const checkApplication = ([, fn, ...args]) => firstReasonOf(check)([fn, ...args])

/** @type {(lambda: _Lambda) => Nullable<string>} */
const checkLambda = ([, pattern, body]) => checkPattern(pattern) ?? check(body)

/** @type {(let_: _Let) => Nullable<string>} */
const checkLet = ([, bindings, body]) => checkBindings(bindings) ?? check(body)

/** @type {(indented: _IndentedString) => Nullable<string>} */
const checkIndentedString = ([, ...parts]) => firstReasonOf(check)(parts)

/**
 * The reason `expression` is not legal Nix, or `null` when it is.
 *
 * Every rule the serializer depends on lives here, and none of them depends on
 * anything the renderer computes:
 *
 * - a reference's root is an identifier — its selection is quoted when it is
 *   not one, but a root has no quoted spelling;
 * - a lambda pattern's names are identifiers and pairwise distinct;
 * - no attribute path in a binding group is a prefix of another.
 *
 * Like {@link serialize}, it only dispatches, so the frame each level of
 * nesting costs stays small.
 *
 * @type {(expression: Expression) => Nullable<string>}
 */
const check = expression => {
    if (typeof expression === 'string') {
        return null
    }
    switch (expression[0]) {
        case 'ref': return checkReference(expression)
        case 'set': return checkSet(expression)
        case 'list': return checkList(expression)
        case 'apply': return checkApplication(expression)
        case 'lambda': return checkLambda(expression)
        case 'let': return checkLet(expression)
        case 'indented-string': return checkIndentedString(expression)
    }
}

/** @type {(reference: _Reference) => string} */
const serializeReference = ([, name, ...selection]) =>
    [name, ...selection.map(attributeName)].join('.')

/** @type {(a: string | _Reference) => (b: string | _Reference) => string | _Reference | null} */
const joinStrings = a => b => typeof a === 'string' && typeof b === 'string' ? `${a}${b}` : null

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
const coalesceStrings = parts => toArray(mergeAdjacent(joinStrings)(parts))

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
 * @type {(part: string | _Reference, referenceFollows: boolean) => string}
 */
const indentedPart = (part, referenceFollows) => {
    if (typeof part === 'string') {
        const escaped = escapeIndented(part)
        return referenceFollows ? escapeTrailingDollar(escaped) : escaped
    }
    return `\${${serializeReference(part)}}`
}

/** @type {(pattern: _OpenSetPattern) => string} */
const serializePattern = ([, ...names]) =>
    `{ ${[...names, '...'].join(', ')} }`

/** @type {(item: _Reference | string) => string} */
const serializeListItem = item =>
    typeof item === 'string' ? quoted(item) : serializeReference(item)

/** @type {(list: _NixList) => List<string>} */
const serializeList = ([, ...items]) =>
    items.length === 0
        ? ['[ ]']
        : flat([['[ '], intersperse(' ')(map(serializeListItem)(items)), [' ]']])

/**
 * The bindings of one group, one per line at `level`.
 *
 * @type {(level: number) => (bindings: readonly _Binding[]) => List<string>}
 */
const serializeBindings = level => {
    const prefix = indent(level)
    const value = serialize(level)
    /** @type {(binding: _Binding) => List<string>} */
    const binding = ([, path, v]) => flat([[prefix, attributePath(path), ' = '], value(v), [';']])
    return bindings => flat(intersperse(['\n'])(map(binding)(bindings)))
}

/** @type {(level: number) => (set: _AttributeSet) => List<string>} */
const serializeSet = level => ([, ...bindings]) =>
    bindings.length === 0
        ? ['{}']
        : flat([['{\n'], serializeBindings(level + 1)(bindings), ['\n', indent(level), '}']])

/** @type {(level: number) => (application: _Application) => List<string>} */
const serializeApplication = level => ([, fn, ...args]) => {
    const argument = serialize(level)
    return flat([
        [serializeReference(fn)],
        flatMap(a => flat([[' '], argument(a)]))(args)
    ])
}

/** @type {(level: number) => (lambda: _Lambda) => List<string>} */
const serializeLambda = level => ([, pattern, body]) =>
    flat([[serializePattern(pattern), ': '], serialize(level)(body)])

/** @type {(level: number) => (let_: _Let) => List<string>} */
const serializeLet = level => ([, bindings, body]) => {
    const prefix = indent(level)
    return flat([
        ['let\n'],
        serializeBindings(level + 1)(bindings),
        ['\n', prefix, 'in\n', prefix],
        serialize(level)(body)
    ])
}

/** @type {(level: number) => (indented: _IndentedString) => List<string>} */
const serializeIndentedString = level => ([, ...parts]) => {
    const coalesced = coalesceStrings(parts)
    const contentIndent = indent(level + 1)
    const content = coalesced
        .map((part, index) => indentedPart(part, typeof coalesced[index + 1] !== 'string'
            && coalesced[index + 1] !== undefined))
        .join('')
        .split('\n')
        .map(protectLeadingWhitespace)
        .map(line => `${contentIndent}${line}`)
        .join('\n')
    return ["''\n", content, '\n', indent(level), "''"]
}

/**
 * What a legal expression renders as, at an indentation `level`. Total: every
 * rule that could refuse an expression is {@link check}'s.
 *
 * @type {(level: number) => (expression: Expression) => List<string>}
 */
const serialize = level => expression => {
    if (typeof expression === 'string') {
        return [quoted(expression)]
    }
    switch (expression[0]) {
        case 'ref': return [serializeReference(expression)]
        case 'set': return serializeSet(level)(expression)
        case 'list': return serializeList(expression)
        case 'apply': return serializeApplication(level)(expression)
        case 'lambda': return serializeLambda(level)(expression)
        case 'let': return serializeLet(level)(expression)
        case 'indented-string': return serializeIndentedString(level)(expression)
    }
}

/**
 * Serializes an expression into composable chunks, or names the first rule it
 * breaks.
 *
 * @type {(expression: Expression) => Result<List<string>, string>}
 */
export const nix = expression => {
    const reason = check(expression)
    return reason === null ? ok(serialize(0)(expression)) : error(reason)
}

/** @type {(chunks: List<string>) => string} */
const withNewline = chunks => `${concat(chunks)}\n`

/**
 * Serializes an expression with exactly one trailing newline on success, or
 * names the first rule it breaks.
 *
 * @type {(expression: Expression) => Result<string, string>}
 */
export const nixToString = expression => mapOk(withNewline)(nix(expression))
