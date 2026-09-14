/**
 * AST types and helpers for the DJS representation.
 *
 * @module
 *
 * @import { Array, Unknown } from '../../media/datajs/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { AstConst, AstBody, AstMember, AstModule, AstModuleRef, Import, Sharing, Unreached } from './types.ts'
 * @import { _Reach, _RunState } from './private.ts'
 */

import { concat, empty, flat, fold, last, map, take, toArray } from '../../types/list/module.f.mjs'
import { fromEntries } from '../../types/object/module.f.mjs'

/** @type {(ast: AstConst) => (state: _RunState) => _RunState} */
const foldOp = ast => state => {
    const djs = toDjs(state)(ast)
    return { ...state, consts: concat(state.consts)([djs]) }
}

/** A member with its value evaluated, by the evaluator given first. @type {(evaluate: (ast: AstConst) => Unknown) => (member: AstMember) => readonly [string, Unknown]} */
const memberValue = evaluate => ([key, value]) => [key, evaluate(value)]

/**
 * The value of one entry. An object's members are written into a plain
 * object in the order the syntax holds them, so the result is the object
 * JavaScript builds from the same literal: a repeated key keeps its first
 * position and takes its last value, and integer-like keys come first.
 *
 * @type {(state: _RunState) => (ast: AstConst) => Unknown}
 */
const toDjs = state => ast => {
    if (ast === null || typeof ast !== 'object') { return ast }
    switch (ast[0]) {
        case 'aref': { return state.args[ast[1]] }
        case 'cref': { return last(null)(take(ast[1] + 1)(state.consts)) }
        case 'array': { return toArray(map(toDjs(state))(ast[1])) }
        default: { return fromEntries(ast[1].map(memberValue(toDjs(state)))) }
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
 * The values an object's members leave in the value: one per key, the last
 * written. A member a later duplicate shadows is syntax the value never
 * holds, so a reference in it reaches nothing. `Map` keeps the last value
 * per key, as `fromEntries` does in `toDjs`.
 *
 * @type {(members: readonly AstMember[]) => readonly AstConst[]}
 */
const memberValues = members => [...new Map(members).values()]

/**
 * The values of an object's members as written, a shadowed member's among
 * them: what the EDAG constructor takes, since it applies every member and
 * evaluates each.
 *
 * @type {(members: readonly AstMember[]) => readonly AstConst[]}
 */
const memberValuesWritten = members => members.map(([, value]) => value)

/**
 * The references one entry makes directly: its `cref`s and `aref`s, however
 * deep inside its own literals, and nothing behind them — a referenced
 * `const` is an entry of its own, visited once as such, which is what keeps
 * this a walk over the syntax rather than over the value's paths. Which of
 * an object's members count is the caller's: the value's, for what a value
 * shares, or the written ones, for what an EDAG evaluates.
 *
 * @type {(members: (members: readonly AstMember[]) => readonly AstConst[]) => (ast: AstConst) => List<AstModuleRef>}
 */
const refsOf = members => ast => {
    if (ast === null || typeof ast !== 'object') { return empty }
    switch (ast[0]) {
        case 'array': { return flat(ast[1].map(refsOf(members))) }
        case 'object': { return flat(members(ast[1]).map(refsOf(members))) }
        default: { return [ast] }
    }
}

/** @type {(value: Unknown) => boolean} */
const isContainer = value => value !== null && typeof value === 'object'

/**
 * Whether an entry denotes a container, given which earlier entries do: a
 * literal does, an alias does if what it names does, and a primitive does
 * not.
 *
 * @type {(imports: readonly Import[]) => (containers: bigint, ast: AstConst) => boolean}
 */
const denotesContainer = imports => (containers, ast) => {
    if (ast === null || typeof ast !== 'object') { return false }
    switch (ast[0]) {
        case 'array':
        case 'object': { return true }
        case 'cref': { return (containers & bit(ast[1])) !== 0n }
        default: { return isContainer(imports[ast[1]].value) }
    }
}

/** @type {(imports: readonly Import[]) => (containers: bigint, ast: AstConst, i: number) => bigint} */
const containerStep = imports => (containers, ast, i) =>
    denotesContainer(imports)(containers, ast) ? containers | bit(i) : containers

/** @type {(reachable: bigint, ref: AstModuleRef) => bigint} */
const reachStep = (reachable, [kind, i]) => kind === 'cref' ? reachable | bit(i) : reachable

/**
 * One entry of the sweep from the export downwards: an entry a reference
 * reaches is reachable, and a reachable entry's own references count and
 * make their targets reachable. A `cref` names an earlier entry — the
 * parser refuses a `const` naming itself or a later one — so by the time
 * the sweep arrives at an entry every reference to it has been seen.
 *
 * @type {(refs: (ast: AstConst) => List<AstModuleRef>) => (reach: _Reach, ast: AstConst, i: number) => _Reach}
 */
const reachEntry = refsOf => (reach, ast, i) => {
    if ((reach.reachable & bit(i)) === 0n) { return reach }
    const refs = toArray(refsOf(ast))
    return { reachable: refs.reduce(reachStep, reach.reachable), refs: concat(reach.refs)(refs) }
}

/**
 * The sweep from the export downwards over a whole body: which entries it
 * reaches, and every reference those entries make, counting an object's
 * members as `members` says.
 *
 * @type {(members: (members: readonly AstMember[]) => readonly AstConst[]) => (body: AstBody) => _Reach}
 */
const reach = members => body =>
    body.reduceRight(reachEntry(refsOf(members)), { reachable: bit(body.length - 1), refs: empty })

/** @type {(args: bigint, ref: AstModuleRef) => bigint} */
const argStep = (args, [kind, i]) => kind === 'aref' ? args | bit(i) : args

/** The indices a set of `n` leaves out. @type {(set: bigint) => (n: number) => readonly number[]} */
const missing = set => n => Array.from({ length: n }, (_, i) => i).filter(i => (set & bit(i)) === 0n)

/**
 * What the export does not reach, by index: the body entries no chain of
 * references from the last entry leads to, and the imports likewise — the
 * sweep {@link sharing} runs, read for what it left out. `run` evaluates
 * every entry and `transpile` reads every import whether the export reaches
 * them or not, so a compiler that follows references alone would drop what
 * this names, and asks first.
 *
 * A member a later duplicate shadows counts here where it does not for
 * sharing: the value drops it, but an EDAG's object constructor applies
 * every member written and evaluates each, so what its reference names is
 * in the graph, not dropped.
 *
 * @type {(module: AstModule) => Unreached}
 */
export const unreached = ([specifiers, body]) => {
    const { reachable, refs } = reach(memberValuesWritten)(body)
    return {
        consts: missing(reachable)(body.length),
        imports: missing(toArray(refs).reduce(argStep, 0n))(specifiers.length),
    }
}

/** Whether a list names something twice. @type {(xs: readonly string[]) => boolean} */
const repeats = xs => new Set(xs).size !== xs.length

/** @type {(m: Import) => readonly [string, Import]} */
const byId = m => [m.id, m]

/**
 * What a module's syntax says about the graph its value denotes — decided
 * where sharing is spelled, a `const` or a module referenced twice, and
 * never by walking the value. A node two references reach is a container
 * `const` referenced twice from the parts of the module the export reaches,
 * a container module reached twice — along two import statements, or along
 * two import edges through other modules, which is what {@link Sharing}'s
 * `reaches` is for — or a reached module whose own value is shared. A leaf
 * referenced twice is two copies of a leaf, which is no sharing, and a
 * `const` the export never reaches is not part of the value at all.
 *
 * Linear in the size of the module and in the modules it reaches: each
 * entry is read once and a reference is counted rather than followed, so a
 * module that doubles a node at every `const` costs its length, not its
 * two-to-the-length; and a reached module lists each module it reaches
 * once, or is shared and lists none, so a diamond of modules is found at
 * its join and the lists stay sets.
 *
 * @type {(body: AstBody) => (imports: readonly Import[]) => Sharing}
 */
export const sharing = body => imports => {
    const containers = body.reduce(containerStep(imports), 0n)
    const nodes = toArray(reach(memberValues)(body).refs)
    const consts = nodes.flatMap(([kind, i]) => kind === 'cref' && (containers & bit(i)) !== 0n ? [`${i}`] : [])
    const reached = nodes.flatMap(([kind, i]) => kind === 'aref' && isContainer(imports[i].value) ? [imports[i]] : [])
    const distinct = [...new Map(reached.map(byId)).values()]
    const reaches = [...reached.map(m => m.id), ...distinct.flatMap(m => m.reaches)]
    const shared = repeats(consts) || repeats(reaches) || distinct.some(m => m.shared)
    return { shared, reaches: shared ? [] : reaches }
}
