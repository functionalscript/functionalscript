/**
 * The EBNF rule mapping: a rewrite of the AST a rule matches, keyed by the
 * rules' spellings.
 *
 * {@link rewrite} takes a map of rules to functions and a rule, and returns
 * the function from the rule's AST — the `Ast<R>` of `../ast/types.ts` — to
 * the same tree with every mapped rule's node replaced by what its function
 * returns. The walk is bottom-up, so a function receives the rules under it
 * already rewritten, and the rule it maps last. See `./README.md` for the
 * design and `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Ast } from '../ast/types.ts'
 * @import { DataRule, Rule, Thunk } from '../types.ts'
 * @import { Checked, Mapped, RuleMap } from './types.ts'
 * @import { _Mapper, _Rewrite } from './private.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { definedEntries, structurallySame } from '../../types/object/module.f.mjs'
import { contains } from '../../types/range_set/module.f.mjs'

/**
 * Whether two values are one spelling: the same value, or the same shape
 * over the same spellings — a number or a string by value, a list element
 * by element, a record entry by entry, and a thunk by what it yields. The
 * pairs of thunks under comparison are carried, and a pair met again is
 * taken as the same, so two rules that name themselves the same way are
 * one spelling and the comparison ends.
 *
 * @type {(seen: readonly (readonly [unknown, unknown])[]) => (a: unknown, b: unknown) => boolean}
 */
const twinIn = seen => (a, b) => {
    if (a === b) { return true }
    if (typeof a === 'function' && typeof b === 'function') {
        if (seen.some(([x, y]) => x === a && y === b)) { return true }
        return twinIn([...seen, [a, b]])(a(), b())
    }
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) { return false }
    const twin = twinIn(seen)
    if (a instanceof Array || b instanceof Array) {
        return a instanceof Array && b instanceof Array && a.length === b.length
            && [...a].every((v, i) => twin(v, b[i]))
    }
    const ea = definedEntries(a)
    const eb = definedEntries(b)
    return ea.length === eb.length && ea.every(([k, v]) => {
        const e = eb.find(([kb]) => kb === k)
        return e !== undefined && twin(v, e[1])
    })
}

/** @type {(a: unknown, b: unknown) => boolean} */
const twin = twinIn([])

/**
 * The function mapped to `rule`, if any. A key is a spelling: the rule the
 * author held when the map was written, and every rule spelled the same.
 *
 * @type {(rules: RuleMap) => (rule: Rule) => _Mapper | undefined}
 */
const find = rules => rule => rules.find(([r]) => twin(r, rule))?.[1]

/**
 * A node with a known number of children — a tuple's, or the two of a
 * variant's tag and branch.
 *
 * @type {(rule: Rule, ast: unknown, length: number) => readonly unknown[]}
 */
const fixed = (rule, ast, length) => {
    assert(ast instanceof Array && ast.length === length, ['not the arity of the rule', rule, ast])
    return ast
}

/**
 * What a thunk's AST becomes: a `const` is the rewrite of what it spells,
 * with the payload's own mapping applied — the thunk *is* that rule; a set
 * is one symbol; a repeat is a list of its item's rewrites, as long as the
 * bounds allow.
 *
 * @type {(rules: RuleMap) => (fr: Thunk, ast: unknown) => unknown}
 */
const thunkChildren = rules => (fr, ast) => {
    const info = fr()
    switch (info[0]) {
        case 'const': { return rewriteRule(rules)(info[1])(ast) }
        case 'set': {
            const [, ...s] = info
            assert(typeof ast === 'number' && contains(s)(ast), ['not a symbol of the rule', fr, ast])
            return ast
        }
        case 'repeat': {
            const [, min, max, r] = info
            assert(ast instanceof Array && min <= ast.length && ast.length <= max, ['not within the bounds of the rule', fr, ast])
            // Spread first: `Array#map` skips the holes of a sparse list,
            // and a hole is no round. Each becomes the `undefined` it is,
            // which no item accepts.
            return [...ast].map(rewriteRule(rules)(r))
        }
        default: { throw ['not a rule', fr, info] }
    }
}

/**
 * The children of a data rule's node, each rewritten. EOF and a string are
 * leaves: EOF's node is empty, and a string's is the code points it spells,
 * which are the string's own and not rules an author holds. A hole in a
 * tuple rule is no rule, so the list is spread to make it the `undefined` it
 * is rather than skipped; a hole in the node is read by index, so it is
 * the `undefined` no child accepts.
 *
 * @type {(rules: RuleMap) => (dr: DataRule, ast: unknown) => unknown}
 */
const dataChildren = rules => (dr, ast) => {
    switch (typeof dr) {
        case 'number': {
            assert(ast === dr, ['not the symbol of the rule', dr, ast])
            return ast
        }
        case 'string': {
            // Compared spread, since `structurallySame` skips the holes of
            // a sparse list and a hole is no symbol.
            const symbols = toArray(stringToCodePointList(dr))
            const leaves = fixed(dr, ast, symbols.length)
            assert(structurallySame([...leaves], symbols), ['not the string of the rule', dr, ast])
            return ast
        }
        case 'object': {
            if (dr === null) { return fixed(dr, ast, 0) }
            if (dr instanceof Array) {
                const items = fixed(dr, ast, dr.length)
                return [...dr].map((r, i) => rewriteRule(rules)(r)(items[i]))
            }
            // A branch is an own entry that is defined: EOF is `null` and
            // a branch, where `undefined` is no rule and none.
            const [tag, branch] = fixed(dr, ast, 2)
            const entry = definedEntries(dr).find(([k]) => k === tag)
            assert(entry !== undefined, ['not a branch of the rule', dr, tag])
            return [tag, rewriteRule(rules)(entry[1])(branch)]
        }
        default: { throw ['not a rule', dr] }
    }
}

/**
 * The AST of `rule` under `rules`: the node's children rewritten, then the
 * rule's own function applied where it has one. The walk is untyped, and
 * what a function takes was checked against the rule's children where the
 * map was whole, at {@link rewrite}; the cast is that check's receipt.
 *
 * @type {(rules: RuleMap) => (rule: Rule) => _Rewrite}
 */
const rewriteRule = rules => rule => ast => {
    const children = typeof rule === 'function'
        ? thunkChildren(rules)(rule, ast)
        : dataChildren(rules)(rule, ast)
    const f = find(rules)(rule)
    return f === undefined ? children : f(/** @type {never} */ (children))
}

/**
 * The rewrite a map of rules defines, for the rule given: from what the rule
 * matches to the tree with every mapped rule's node — the given rule's
 * included — replaced by what its function returns.
 *
 * A map names each spelling once; a rule mapped twice, or two rules of one
 * spelling, is refused, since one would silently win. An AST that is not
 * the rule's — a node of the wrong
 * arity, a branch the variant lacks, a symbol outside the set, a repetition
 * outside its bounds — is refused where the walk reads it, naming the rule,
 * rather than rewritten into a plausible value.
 *
 * The signature is spelled as `@template` and `@returns` rather than as one
 * `@type`: on a JavaScript arrow, `tsc` runs the latter's nested generic
 * into its instantiation limit, and this spelling of the same type does
 * not.
 *
 * @template {RuleMap} const M
 * @param {M & Checked<M>} rules
 * @returns {<const R extends Rule>(rule: R) => (ast: Ast<R>) => Mapped<R, M>}
 */
export const rewrite = rules => {
    /** @type {RuleMap} */
    const map = rules
    assert(map.every(([r], i) => !map.slice(0, i).some(([p]) => twin(p, r))), ['a rule mapped twice', map])
    return rule => ast => /** @type {any} */ (rewriteRule(map)(rule)(ast))
}
