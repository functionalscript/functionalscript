/**
 * Scalar and aggregate loop helpers at the FAST-to-EDAG boundary.
 *
 * A function consisting of its invocation loop can reuse the function itself
 * as the recursive helper. This preserves its arity, frame and self identity;
 * a loop with one-time setup or result processing needs a separate helper.
 * The baseline domain is one fixed parameter without a rest binding.
 * General normal-exit helpers use one aggregate state parameter and one
 * aggregate result, without changing the established scalar graph.
 *
 * @module
 *
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../../js/ast/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.js'
import { toArray } from '../../../types/list/alt/module.f.mjs'
import { freeLoopBindings } from '../../../js/ast/control/module.f.mjs'

/**
 * Pack owning statement transfers without crossing value operands or ordinary
 * function boundaries or into nested loops, which have their own helper owner.
 * Escaping transfers still require completion lowering. An explicit postorder
 * worklist keeps deeply nested statement regions off the host stack.
 * @type {(loop: Loop) => Block}
 */
const aggregateBody = loop => {
    /** @typedef {{ readonly block: Block; readonly finish: boolean; readonly rest: Work | null }} Work */
    /** @typedef {{ readonly first: Block; readonly tail: Result | null }} Result */
    /** @type {Work | null} */
    let work = { block: loop.body, finish: false, rest: null }
    /** @type {Result | null} */
    let blocks = null
    while (work !== null) {
        const { block, finish, rest } = /** @type {Work} */ (work)
        work = rest
        if (!finish) {
            const children = block.statements.flatMap(statement => statement[0] === 'block' ? [statement[2]] : statement[0] === 'if' ? [statement[3], statement[4]] : [])
            work = children.reduceRight((rest, block) => ({ block, finish: false, rest }), /** @type {Work} */ ({ block, finish: true, rest }))
            continue
        }
        /** @type {List<Statement>} */
        let statements = null
        for (const statement of block.statements.toReversed()) {
            if (statement[0] === 'block') {
                /** @type {Result} */
                const child = assertNotNullish(blocks)
                blocks = child.tail
                statements = { first: ['block', statement[1], child.first], tail: statements }
            } else if (statement[0] === 'if') {
                /** @type {Result} */
                const otherwise = assertNotNullish(blocks)
                /** @type {Result} */
                const then = assertNotNullish(otherwise.tail)
                blocks = then.tail
                statements = { first: ['if', statement[1], statement[2], then.first, otherwise.first], tail: statements }
            } else {
                statements = { first: statement, tail: statements }
            }
        }
        const exit = block.exit
        blocks = { first: { statements: toArray(statements), exit: (exit[0] === 'break' || exit[0] === 'continue') && exit[1] === loop.target
            ? [exit[0], exit[1], [['array', exit[2]]]] : exit }, tail: blocks }
    }
    return assertNotNullish(blocks).first
}

/**
 * Whether a value is a read of `binding` itself: a `ref` to it, and not a
 * value computed from it.
 *
 * @type {(value: Value, binding: BindingId) => boolean}
 */
export const namesBinding = (value, binding) => value instanceof Array && value[0] === 'ref' && value[1] === binding

/**
 * Prefix reads may alias established captures or self without becoming current
 * invocation inputs. Each returned lineage keeps its fixed parameter position.
 * Root callers check their invocation layout before requesting these aliases.
 * @type {(fn: FastFunction, before: readonly Statement[]) => readonly (readonly BindingId[])[] | null}
 */
export const invocationAliases = (fn, before) => {
    const inputs = /** @type {readonly BindingId[]} */ ([...fn.parameters, ...(fn.rest === null ? [] : [fn.rest])])
    let aliases = inputs.map(parameter => [parameter])
    let established = [...inputs, ...fn.captures.map(capture => capture.binding), ...(fn.self === null ? [] : [fn.self])]
    for (const statement of before) {
        if (statement[0] !== 'define') { return null }
        const value = statement[2]
        if (!(value instanceof Array) || value[0] !== 'ref' || !established.includes(value[1])) { return null }
        established = [...established, statement[1]]
        aliases = aliases.map(lineage => lineage.includes(value[1]) ? [...lineage, statement[1]] : lineage)
    }
    return aliases
}

/**
 * Reusing the function rebinds its parameters on each continue. Body reads of
 * entry parameters or their prefix aliases could then lose the original value.
 * Iteration parameters are bound by the free-reference owner; captures and self
 * do not belong to these parameter lineages and remain stable across calls.
 * @type {(loop: Loop, aliases: readonly (readonly BindingId[])[]) => boolean}
 */
export const readsEntryParameters = (loop, aliases) => {
    const entries = new Set(aliases.flat())
    return freeLoopBindings(loop).some(binding => entries.has(binding))
}

/**
 * The root scalar loop where its entry aliases the current invocation and its
 * result is returned directly, or `null` where reconstruction would change
 * the function boundary. Before the loop, aliases of invocation inputs, captures
 * and self establish no computation or identity. The entry must still follow
 * the current invocation input's own alias lineage.
 *
 * @type {(fn: FastFunction) => Loop | null}
 */
export const rootLoopOf = fn => {
    const { parameters, rest, body } = fn
    const exit = body.exit
    if (parameters.length !== 1 || rest !== null || exit[0] !== 'return' || exit[1] !== fn.target) { return null }
    const last = body.statements.at(-1)
    if (last === undefined || last[0] !== 'loop') { return null }
    const loop = last[1]
    if (loop.parameters.length !== 1 || loop.results.length !== 1 || !namesBinding(exit[2], loop.results[0])) { return null }
    const aliases = invocationAliases(fn, body.statements.slice(0, -1))
    return aliases !== null && aliases[0].some(binding => namesBinding(loop.initial[0], binding)) && !readsEntryParameters(loop, aliases) ? loop : null
}

/**
 * The scalar helper as an ordinary normalized function, so its frame and
 * captures use the same graph construction as every function. Its invocation
 * loop is canonical; graph construction reuses this very function for it.
 * Entry expressions stay at the original loop statement in the caller.
 *
 * @type {(loop: Loop) => FastFunction}
 */
export const scalarHelper = loop => {
    const target = /** @type {const} */ ({ kind: 'function', index: loop.target.index })
    return {
        target,
        parameters: loop.parameters,
        rest: null,
        self: null,
        captures: freeLoopBindings(loop).map(binding => ({ binding, value: ['ref', binding] })),
        body: {
            statements: [['loop', { ...loop, initial: loop.parameters.map(binding => ['ref', binding]) }]],
            exit: ['return', target, ['ref', loop.results[0]]],
        },
    }
}

/**
 * A normal-exit helper with one state array, regardless of the declared state
 * arity. Its canonical invocation loop uses the ordinary root resolver. Each
 * continue packages simultaneous next values; each break packages the declared
 * results, including zero or one. Source bindings and helper identities remain
 * separate even when their presentation indices coincide. State-slot reads are
 * established at iteration entry, so nested helpers capture the current values
 * without turning a source lazy initializer into an eager capture.
 * @type {(loop: Loop) => FastFunction}
 */
export const aggregateHelper = loop => {
    const target = /** @type {const} */ ({ kind: 'function', index: loop.target.index })
    const argument = /** @type {const} */ ({ index: loop.target.index })
    const state = /** @type {const} */ ({ index: loop.target.index })
    const result = /** @type {const} */ ({ index: loop.target.index })
    const body = aggregateBody(loop)
    return {
        target,
        parameters: [argument],
        rest: null,
        self: null,
        captures: freeLoopBindings(loop).map(binding => ({ binding, value: ['ref', binding] })),
        body: {
            statements: [['loop', {
                target: loop.target,
                parameters: [state],
                initial: [['ref', argument]],
                results: [result],
                body: {
                    statements: [
                        ...loop.parameters.map((binding, i) => /** @type {Statement} */ (['define', binding, ['.', ['ref', state], i], 'required'])),
                        ...body.statements,
                    ],
                    exit: body.exit,
                },
            }]],
            exit: ['return', target, ['ref', result]],
        },
    }
}
