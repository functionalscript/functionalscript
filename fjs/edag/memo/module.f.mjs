/**
 * Interpret analyzed EDAG with an immutable cache of demanded shared nodes.
 * Each call starts a fresh cache while retaining evaluated captures by identity.
 *
 * @module
 * @import { Exp, ExpOp, StepOver, ItemsOver, Over } from '../types.ts'
 * @import { Analysis, Node, Operand, Step } from '../analysis/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke } from '../value/call/types.ts'
 * @import { Invocation } from './types.ts'
 * @import { Context, Evaluation } from '../operations/types.ts'
 * @import { _Cache } from './private.ts'
 */

import { assertOk } from '../../asserts/module.f.mjs'
import { isArray } from '../../types/array/module.f.mjs'
import { ok, unwrap } from '../../types/result/module.f.mjs'
import { analysis, checked } from '../analysis/module.f.mjs'
import { operation } from '../operations/module.f.mjs'

/** Restore one operand from the already restored prefix of the analysis. @type {(code: readonly ExpOp[], operand: Operand) => Exp} */
const expression = (code, operand) => isArray(operand) ? code[operand[1]] : operand

/** @type {(code: readonly ExpOp[], items: ItemsOver<Operand>) => ItemsOver<Exp>} */
const codeItems = (code, items) => items.map(item => isArray(item) && item[0] === '...'
    ? ['...', expression(code, item[1])] : expression(code, item))

/** @type {(code: readonly ExpOp[], step: Step) => StepOver<Exp>} */
const codeStep = (code, step) => {
    const [tag, operand, continuation] = step
    if (tag === '|.') {
        const key = expression(code, operand)
        return continuation === undefined ? [tag, key] : [tag, key, codeStep(code, continuation)]
    }
    const args = codeItems(code, operand)
    if (tag === '|!()') { return [tag, args] }
    return continuation === undefined ? [tag, args] : [tag, args, codeStep(code, continuation)]
}

/** Restore code, retaining table sharing, for the bodies carried by values. @type {(code: readonly ExpOp[], node: Node) => ExpOp} */
const codeNode = (code, node) => {
    switch (node[0]) {
        case '[]': { return ['[]', codeItems(code, node[1])] }
        case '{}': { return ['{}', node[1].map(p => p[0] === '...'
            ? ['...', expression(code, p[1])]
            : [':', expression(code, p[1]), expression(code, p[2])])] }
        case '=>': { return ['=>', node[1], node[2].map(x => expression(code, x)), expression(code, node[3])] }
        case ',': { return [',', node[1].map(x => expression(code, x))] }
        case '()': { return ['()', expression(code, node[1]), codeItems(code, node[2])] }
        case '?.()': {
            const [, callee, args, continuation] = node
            const head = /** @type {const} */ (['?.()', expression(code, callee), codeItems(code, args)])
            return /** @type {ExpOp} */ (continuation === undefined ? head : [...head, codeStep(code, continuation)])
        }
        case '.': case '?.': {
            const [tag, receiver, key, continuation] = node
            const head = /** @type {const} */ ([tag, expression(code, receiver), expression(code, key)])
            return /** @type {ExpOp} */ (continuation === undefined ? head : [...head, codeStep(code, continuation)])
        }
        default: {
            // All remaining tuples contain only metadata, primitives and
            // operand references, with no lists or continuation productions.
            return /** @type {ExpOp} */ (/** @type {unknown} */ (node.map(part => isArray(part) ? expression(code, part) : part)))
        }
    }
}

/** @type {(a: Analysis, context: Context, root: Operand) => ValueResult} */
const evaluate = (a, context, root) => {
    const { nodes, shared } = a
    const code = nodes.reduce((/** @type {readonly ExpOp[]} */ prefix, node) => [...prefix, codeNode(prefix, node)], [])

    /** @type {(operand: Operand, cache: _Cache) => Evaluation<_Cache>} */
    const operand = (operand, cache) => {
        if (!isArray(operand)) { return [cache, ok(operand)] }
        const [, index] = operand
        const established = cache.find(([i]) => i === index)
        if (established !== undefined) { return [cache, ok(established[1])] }
        const [next, result] = run(nodes[index], cache)
        const [kind, value] = result
        return [kind === 'ok' && shared.includes(index) ? [...next, [index, value]] : next, result]
    }

    const run = operation({ context, operand, expression: e => expression(code, e), invoke })
    return operand(root, [])[1]
}

/** Invoke a represented function, with fresh body state and retained captures. @type {Invoke} */
export const invoke = (fn, fixed, rest) => {
    const a = assertOk(analysis(fn))
    const [, index] = /** @type {import('../analysis/types.ts').Ref} */ (a.root)
    const [, , , body] = /** @type {Over<import('../types.ts').Function, Operand>} */ (a.nodes[index])
    return evaluate(a, { frame: fn[2], args: [], fixed, rest, self: fn }, body)
}

/** Interpret a complete analyzed graph. Binding admission happens once here. @type {(a: Analysis) => (context: Invocation) => ValueResult} */
export const memo = a => {
    const table = unwrap(checked(a))
    return context => evaluate(table, { ...context, frame: [] }, table.root)
}
