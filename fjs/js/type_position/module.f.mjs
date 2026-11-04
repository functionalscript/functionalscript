/**
 * Where a type stands in TypeScript text, as far as its tokens tell for
 * certain: the fallback a README's `ts` fence is coloured by asks it which
 * names stand in a type, so `string` there is a keyword and a value named
 * `string` stays a name.
 *
 * **Only what is certain is a type.** A name such as `number` is a type in
 * `x: number` and a value in `or(option, number)`, and the repository's own
 * `rtti` builders are values with those names. So text enters a type only
 * where the grammar admits nothing else:
 *
 * - the right side of `type X =`, and an `interface`'s header and body;
 * - a declaration's annotation, `const x: T`;
 * - a parameter's annotation, in a list certain to be one: after
 *   `function`, before `=>`, before a method's `{`, or before a return type
 *   and then `=>`;
 * - a function's return type, `): T`;
 * - the name after `as` or `satisfies`, and its type arguments.
 *
 * Everything else is a value: an object literal's `a: b`, a call's
 * arguments, a ternary's `:`, and `a < b`. A type missed costs a colour; a
 * value taken for a type would claim what the text does not say.
 *
 * **Inside a type, a name is a type but where it names something**: a
 * member's or a parameter's name, before `:`, `?:` or `is`, a method's
 * before `(`, a mapped key's before `in`, a name after `.`, and the value
 * `typeof` reads. A type ends at its bracket, at a delimiter of what holds
 * it (`,`, `=`, `)` …), or at a line's end, unless the next line goes on
 * with `|`, `&`, `?`, `:` or `=>`, which no statement opens with.
 *
 * @module
 *
 * @import { JsToken } from '../../ebnf/lib/js/types.ts'
 * @import { _Frame } from './private.ts'
 */

import { isTrivia } from '../../ebnf/lib/js/module.f.mjs'

/** The tokens a line that goes on with a type opens with. */
const continuations = ['|', '&', '?', ':', '=>', 'extends']

/**
 * TypeScript's type operators, which stand in a type and are none: they
 * are no answer here.
 */
const operators = ['asserts', 'infer', 'is', 'keyof', 'readonly', 'unique']

/** The frame a text starts in: a value, holding no declaration. */
const valueFrame = /** @type {_Frame} */ ({ mode: 'value', close: null, ends: [], newline: false, decl: false, declStatement: false, ternary: 0, default: false, clause: false })

/**
 * A frame of `mode`, closed by `close`.
 *
 * @type {(mode: _Frame['mode'], close: string | null) => _Frame}
 */
const frame = (mode, close) => ({ ...valueFrame, mode, close })

/**
 * A type without a bracket of its own, ending at one of `ends` met in it,
 * and at a line's end where `newline` says so.
 *
 * @type {(ends: readonly string[], newline: boolean) => _Frame}
 */
const extent = (ends, newline) => ({ ...frame('type', null), ends, newline })

/** Whether a token is a name. @type {(token: JsToken | undefined) => token is Extract<JsToken, { readonly kind: 'id' }>} */
const isName = token => token !== undefined && token.kind === 'id'

/** Whether a token is the name `word`. @type {(word: string) => (token: JsToken | undefined) => boolean} */
const isWord = word => token => isName(token) && token.value === word

/**
 * For each token of `tokens`, whether it is a name that stands where a
 * type stands. Trivia is skipped; a line's end is read where it ends a type.
 *
 * @type {(tokens: readonly JsToken[]) => readonly boolean[]}
 */
export const typePositions = tokens => {
    /** The tokens that are no trivia, by their index in `tokens`. */
    const at = tokens.flatMap((t, i) => isTrivia(t.kind) ? [] : [i])
    /** @type {(j: number) => JsToken | undefined} */
    const tok = j => j < 0 || j >= at.length ? undefined : tokens[at[j]]
    const kinds = at.map(i => tokens[i].kind)
    /** Whether the word at `j` names a property: after `.` or `?.`. @type {(j: number) => boolean} */
    const isProperty = j => kinds[j - 1] === '.' || kinds[j - 1] === '?.'
    /** Whether a line ends between the token before `j` and `j`. @type {(j: number) => boolean} */
    const lineBefore = j => j > 0 && tokens.slice(at[j - 1] + 1, at[j]).some(t => t.kind === 'nl')
    /**
     * The `)` or `]` closing the `(` or `[` at `j`, or `-1` where none does.
     *
     * @type {(j: number) => number}
     */
    const closing = j => {
        const open = kinds[j]
        const close = open === '(' ? ')' : ']'
        let depth = 0
        for (let k = j; k < at.length; k = k + 1) {
            depth = kinds[k] === open ? depth + 1 : kinds[k] === close ? depth - 1 : depth
            if (depth === 0) { return k }
        }
        return -1
    }
    /**
     * Whether the `[` at `j`, opening a member of a type literal, holds a
     * computed key, a value, rather than an index signature's `k: T` or a
     * mapped type's `K in T`.
     *
     * @type {(j: number) => boolean}
     */
    const computedKey = j => {
        const c = closing(j)
        let depth = 0
        for (let k = j + 1; k < c; k = k + 1) {
            if (depth === 0 && (kinds[k] === ':' || kinds[k] === 'in')) { return false }
            depth = '([{'.includes(kinds[k]) ? depth + 1 : ')]}'.includes(kinds[k]) ? depth - 1 : depth
        }
        return c !== -1
    }
    /**
     * Whether the type after a `:` at `j` runs to `=>` before anything that
     * would end it: a return type and then an arrow.
     *
     * @type {(j: number) => boolean}
     */
    const arrowAfter = j => {
        let depth = 0
        for (let k = j + 1; k < at.length; k = k + 1) {
            const kind = kinds[k]
            // JavaScript sets no line's end before an arrow's `=>`.
            if (depth === 0 && (lineBefore(k) || [',', ';', ')', ']', '}', '='].includes(kind))) { return false }
            if (depth === 0 && kind === '=>') { return true }
            depth = kind === '(' || kind === '[' || kind === '{' || kind === '<' ? depth + 1
                : kind === ')' || kind === ']' || kind === '}' || kind === '>' ? depth - 1
                : depth
        }
        return false
    }
    /**
     * Whether the `(` at `j` opens a parameter list, for certain.
     *
     * @type {(j: number, ternary: number) => boolean}
     */
    const isParams = (j, ternary) => {
        const before = tok(j - 1)
        if ((before?.kind === 'function' && !isProperty(j - 1)) || (isName(before) && tok(j - 2)?.kind === 'function' && !isProperty(j - 2))) { return true }
        const c = closing(j)
        const after = tok(c + 1)?.kind
        if (c === -1) { return false }
        if (after === '=>') { return true }
        if (after === '{' && isName(before) && !lineBefore(c + 1)) { return true }
        return after === ':' && ternary === 0 && arrowAfter(c + 1)
    }
    /** @type {readonly _Frame[]} */
    let frames = [valueFrame]
    /** @type {readonly number[]} */
    let typed = []
    let alias = false
    let iface = false
    let asNext = false
    let asGeneric = false
    let skipNext = false
    /** @type {(f: Partial<_Frame>) => void} */
    const update = f => { frames = [...frames.slice(0, -1), { ...frames[frames.length - 1], ...f }] }
    /** @type {() => _Frame} */
    const top = () => frames[frames.length - 1]
    /** Pops the types with no bracket of their own. */
    const popExtents = () => {
        while (frames.length > 1 && top().close === null) { frames = frames.slice(0, -1) }
    }
    for (let j = 0; j < at.length; j = j + 1) {
        const t = /** @type {JsToken} */ (tok(j))
        const kind = t.kind
        const next = tok(j + 1)
        // A line's end ends a type that ends there, unless the line goes on,
        // and a `type X` that met no `=`, unless its parameters are open.
        if (lineBefore(j) && !continuations.includes(kind)) {
            while (top().close === null && top().newline) { frames = frames.slice(0, -1) }
            alias = alias && top().close === '>'
        }
        while (top().close === null && top().mode === 'type' && top().ends.includes(kind)) { frames = frames.slice(0, -1) }
        const { mode } = top()
        const wasAs = asNext
        asNext = false
        if (kind === ')' || kind === ']' || kind === '}') {
            popExtents()
            const closed = top()
            if (frames.length > 1 && closed.close === kind) { frames = frames.slice(0, -1) }
            // A parameter list's return type.
            if (closed.mode === 'params' && next?.kind === ':') {
                frames = [...frames, extent(['=>', '{', ';'], true)]
                j = j + 1
            }
            continue
        }
        if ((kind === '>' || kind === '>>' || kind === '>>>') && (mode === 'type' || frames.some(f => f.close === '>'))) {
            for (let n = 0; n < kind.length; n = n + 1) {
                popExtents()
                if (top().close === '>') { frames = frames.slice(0, -1) }
            }
            continue
        }
        if (kind === '(') {
            frames = [...frames, mode === 'type' ? frame('type', ')') : isParams(j, top().ternary) ? frame('params', ')') : frame('value', ')')]
            continue
        }
        if (kind === '[') {
            // A member's computed key, in a type literal, is a value.
            const key = mode === 'type' && top().close === '}' && ['{', ';', ','].includes(kinds[j - 1]) && computedKey(j)
            frames = [...frames, frame(mode === 'type' && !key ? 'type' : 'value', ']')]
            continue
        }
        if (kind === '{') {
            // An import's or export's names, whose `as` renames a value.
            const clause = mode === 'value' && (kinds[j - 1] === 'import' || kinds[j - 1] === 'export' || (isWord('type')(tok(j - 1)) && (kinds[j - 2] === 'import' || kinds[j - 2] === 'export')))
            frames = [...frames, { ...frame(mode === 'type' || iface ? 'type' : 'value', '}'), clause }]
            iface = false
            continue
        }
        if (kind === '<') {
            if (mode === 'type' || alias || asGeneric) { frames = [...frames, frame('type', '>')] }
            asGeneric = false
            continue
        }
        asGeneric = false
        // The value `typeof` reads, and the name an interface declares,
        // are no types.
        if (kind === 'typeof' && mode === 'type') {
            skipNext = true
            continue
        }
        if (kind === 'interface' && mode === 'value' && isName(next)) {
            iface = true
            skipNext = true
            frames = [...frames, extent(['{'], false)]
            continue
        }
        if (mode === 'value') {
            // A declaration's word opens a declaration where a binding
            // follows it, and is a name where it is a property's.
            if ((kind === 'const' || kind === 'let' || kind === 'var') && !isProperty(j)
                && (isName(next) || next?.kind === '{' || next?.kind === '[')) { update({ decl: true, declStatement: true }) }
            else if (kind === ';') { update({ decl: false, declStatement: false }); alias = false }
            else if (kind === ',') { update({ decl: top().declStatement }) }
            else if (kind === '?' && next?.kind !== ':') { update({ ternary: top().ternary + 1 }) }
            else if (kind === '=') {
                if (alias) { frames = [...frames, extent([';'], true)]; alias = false }
                else { update({ decl: false }) }
            }
            else if (kind === ':') {
                const prior = tok(j - 1)?.kind
                if (top().decl && (prior === 'id' || prior === '}' || prior === ']')) { frames = [...frames, extent([',', '=', ';', ')'], true)] }
                else if (top().ternary > 0) { update({ ternary: top().ternary - 1 }) }
            }
            else if (isName(t)) {
                if (wasAs) {
                    typed = [...typed, at[j]]
                    asGeneric = next?.kind === '<'
                }
                else if (isWord('type')(t) && isName(next) && !lineBefore(j + 1)) { alias = true }
                // An import's or export's `as`, in its names or after `*`,
                // renames a value: it asserts no type.
                else if ((isWord('as')(t) || isWord('satisfies')(t)) && isName(next) && !lineBefore(j + 1)
                    && !top().clause && kinds[j - 1] !== '*') { asNext = true }
            }
            continue
        }
        if (mode === 'params') {
            if (kind === ',') { update({ default: false }) }
            else if (kind === '=') { update({ default: true }) }
            else if (kind === ':' && !top().default) { frames = [...frames, extent([',', ')', '='], false)] }
            continue
        }
        // A type. A conditional's `?` and `:` are counted, so a name before
        // its `:` is a type, not a member's name.
        if (kind === '?' && next?.kind !== ':') { update({ ternary: top().ternary + 1 }); continue }
        if (kind === ':' && top().ternary > 0) { update({ ternary: top().ternary - 1 }); continue }
        if (!isName(t)) { continue }
        if (skipNext) { skipNext = false; continue }
        const after = next?.kind
        const named = (after === ':' && top().ternary === 0) || (after === '?' && tok(j + 2)?.kind === ':')
            || isWord('is')(next) || after === 'in'
            || (after === '(' && top().close === '}')
            || tok(j - 1)?.kind === '.'
        if (!named && !operators.includes(t.value)) { typed = [...typed, at[j]] }
    }
    return tokens.map((_, i) => typed.includes(i))
}
