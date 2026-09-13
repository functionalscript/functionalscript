/**
 * AST types and helpers for the DJS representation.
 *
 * @module
 *
 * @import { Array, Unknown } from '../../djs/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { AstConst, AstBody, AstModuleRef, Denotation } from './types.ts'
 * @import { _FoldObjectState, _Reach, _RunState } from './private.ts'
 */

import { concat, empty, flat, fold, last, map, take, toArray } from '../../types/list/module.f.mjs'
import { fromEntries } from '../../types/object/module.f.mjs'

const { entries, values } = Object

/** @type {(ast: AstConst) => (state: _RunState) => _RunState} */
const foldOp = ast => state => {
    const djs = toDjs(state)(ast)
    return { ...state, consts: concat(state.consts)([djs]) }
}

/** @type {(entry: [string, AstConst]) => (state: _FoldObjectState) => _FoldObjectState} */
const foldAstObjectOp = entry => state => {
    const e = concat(state.entries)([[entry[0], (toDjs(state.runState)(entry[1]))]])
    return { ...state, entries: e }
}

/** @type {(state: _RunState) => (ast: AstConst) => Unknown} */
const toDjs = state => ast => {
    switch (typeof ast) {
        case 'boolean':
        case 'number':
        case 'string':
        case 'bigint': { return ast }
        default: {
            if (ast === null) { return ast }
            if (ast === undefined) { return ast }
            if (ast instanceof Array) {
                switch (ast[0]) {
                    case 'aref': { return state.args[ast[1]] }
                    case 'cref': { return last(null)(take(ast[1] + 1)(state.consts)) }
                    case 'array': { return toArray(map(toDjs(state))(ast[1])) }
                }
            }
            const e = fold(foldAstObjectOp)({ runState: state, entries: null })(entries(ast)).entries
            return fromEntries(e)
        }
    }
}

/**
 * Evaluates a module body against its imported modules and returns the value
 * the module yields — the last entry of the body.
 *
 * Entries are evaluated left to right, so a `cref` resolves to an already
 * evaluated entry. A reference is shared, not copied: two properties holding
 * the same `['cref', i]` deserialize to the same object, which is what lets a
 * DJS module denote a graph rather than a tree.
 *
 * @type {(body: AstBody) => (args: Array) => Unknown}
 */
export const run = body => args => {
    const state = fold(foldOp)({ body, args, consts: null })(body)
    return last(null)(state.consts)
}

// for functions

// ── sharing ───────────────────────────────────────────────────────────────────

/** The bit of a body index, in a set of indices spelled as a bigint. @type {(i: number) => bigint} */
const bit = i => 1n << BigInt(i)

/**
 * The references one entry makes directly: its `cref`s and `aref`s, however
 * deep inside its own literals, and nothing behind them — a referenced
 * `const` is an entry of its own, visited once as such, which is what keeps
 * this a walk over the syntax rather than over the value's paths.
 *
 * @type {(ast: AstConst) => List<AstModuleRef>}
 */
const refsOf = ast => {
    if (ast === null || typeof ast !== 'object') { return empty }
    if (ast instanceof Array) {
        return ast[0] === 'array' ? flat(ast[1].map(refsOf)) : [ast]
    }
    return flat(values(ast).map(refsOf))
}

/**
 * Whether an entry denotes a container, given which earlier entries do: a
 * literal does, an alias does if what it names does, and a primitive does
 * not.
 *
 * @type {(imports: readonly Denotation[]) => (containers: bigint, ast: AstConst) => boolean}
 */
const denotesContainer = imports => (containers, ast) => {
    if (ast === null || typeof ast !== 'object') { return false }
    if (!(ast instanceof Array)) { return true }
    switch (ast[0]) {
        case 'array': { return true }
        case 'cref': { return (containers & bit(ast[1])) !== 0n }
        default: { const { value } = imports[ast[1]]; return value !== null && typeof value === 'object' }
    }
}

/** @type {(imports: readonly Denotation[]) => (containers: bigint, ast: AstConst, i: number) => bigint} */
const containerStep = imports => (containers, ast, i) =>
    denotesContainer(imports)(containers, ast) ? containers | bit(i) : containers

/** @type {(reachable: bigint, ref: AstModuleRef) => bigint} */
const reachStep = (reachable, [kind, i]) => kind === 'cref' ? reachable | bit(i) : reachable

/**
 * One entry of the sweep from the export downwards: an entry two references
 * reach is reachable, and a reachable entry's own references count and make
 * their targets reachable. A `cref` points at an earlier entry, so by the
 * time the sweep arrives at an entry every reference to it has been seen.
 *
 * @type {(reach: _Reach, ast: AstConst, i: number) => _Reach}
 */
const reachEntry = (reach, ast, i) => {
    if ((reach.reachable & bit(i)) === 0n) { return reach }
    const refs = toArray(refsOf(ast))
    return { reachable: refs.reduce(reachStep, reach.reachable), refs: concat(reach.refs)(refs) }
}

/** A reference as a key, so that two references to one node are equal. @type {(ref: AstModuleRef) => string} */
const key = ([kind, i]) => `${kind}${i}`

/**
 * Whether the value a module denotes has a node two references reach —
 * decided from the syntax, where sharing is spelled: a container `const` or
 * a container import referenced twice from the parts of the module the
 * export reaches, or an import whose own value has such a node. A leaf
 * referenced twice is two copies of a leaf, which is no sharing, and a
 * `const` the export never reaches is not part of the value at all.
 *
 * Linear in the size of the module: each entry is read once, and a
 * reference is counted rather than followed, so a module that doubles a
 * node at every `const` costs its length, not its two-to-the-length.
 *
 * @type {(body: AstBody) => (imports: readonly Denotation[]) => boolean}
 */
export const shared = body => imports => {
    const containers = body.reduce(containerStep(imports), 0n)
    /** @type {_Reach} */
    const start = { reachable: bit(body.length - 1), refs: empty }
    const { refs } = body.reduceRight(reachEntry, start)
    const nodes = toArray(refs).filter(([kind, i]) => kind === 'cref'
        ? (containers & bit(i)) !== 0n
        : imports[i].value !== null && typeof imports[i].value === 'object')
    return new Set(nodes.map(key)).size !== nodes.length
        || nodes.some(([kind, i]) => kind === 'aref' && imports[i].shared)
}

