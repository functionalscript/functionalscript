/**
 * A module's text as the graph of the EDAG it lowers to: what a page that
 * draws a module's expression DAG shows, and how the walk reads each node
 * ({@link _shapeOf}).
 *
 * **A module with named exports draws as the object of its exports.** Only
 * a module whose one export is its default draws as that value: reading
 * `.default` off any other would draw a value the source never wrote —
 * `undefined` for `export const a = []`.
 *
 * @module
 *
 * @import { Exp, GroupMember } from '../../../edag/types.ts'
 * @import { Graph, Shape } from '../../../website/demo/graph/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { _defaultExport, _moduleExports, tryUnresolved } from '../module.f.js'
import { graphOf } from '../../../website/demo/graph/module.f.js'
import { operatorShape, unsupported } from '../../graph/module.f.js'
import { ok } from '../../../types/result/module.f.js'
import { parsed } from '../../stage_demo/module.f.js'

/** The group's or closure's captured slots, in frame order.
 * @type {(slots: unknown) => readonly (readonly [string, unknown])[]}
 */
const framePorts = slots => /** @type {readonly unknown[]} */ (slots).map((slot, i) => [`frame ${i}`, slot])

/**
 * How the walk reads one `Exp`: the operators the EDAG shares with FAST
 * and the source AST through [their shared shape](../../graph/module.f.js),
 * and the EDAG's own forms here — functions, their inputs, `self` and
 * `throw`.
 *
 * **An input is inline, as a primitive is.** `undefined` — the EDAG holds
 * it as the zero-operand operator `['undefined']` — is a plain value, and a
 * terminal is marked as one. **A terminal's identity is its scope's**, so
 * drawing it inline loses nothing. `args`, `rest`, `arg n` and `frame n` are
 * the values a scope receives from outside it, and every reference to one
 * inside a body is that body's own: one scope never reaches another's
 * inputs except through a frame slot. A node with several arrows into it would
 * only restate what the reference's position already says. Operators, even
 * childless ones like an empty `[]`, stay nodes: two of those are two
 * values.
 *
 * Reads `exp` by its runtime shape rather than its static type, so a proof
 * can hand it a tag the parser does not produce yet.
 *
 * @type {(exp: unknown) => Shape<unknown>}
 */
export const _shapeOf = operatorShape({ array: '[]', object: '{}' })(exp => {
    const tag = exp[0]
    // Length is a value port, while frame and lazy body are expression edges;
    // a fixed parameter and a frame slot are inputs, their index metadata.
    if (tag === 'arg') { return { inline: `arg ${exp[1]}`, kind: 'terminal' } }
    if (tag === 'frame') { return { inline: `frame ${exp[1]}`, kind: 'terminal' } }
    if (tag === '=>') {
        // One port per slot, named as the body's read of it is, and the
        // body after them: a function that captures nothing has no frame
        // port at all.
        return {
            kind: 'op', label: '=>',
            children: [
                ['length', exp[1]],
                ...framePorts(exp[2]),
                ['body', exp[3], 'lazy'],
            ],
        }
    }
    if (tag === 'group') {
        const functions = /** @type {readonly GroupMember[]} */ (exp[2])
        return {
            kind: 'op', label: 'group',
            children: [
                ...framePorts(exp[1]),
                ...functions.flatMap(([length, body], i) => /** @type {const} */ ([
                    [`length ${i}`, length], [`body ${i}`, body, 'lazy'],
                ])),
            ],
        }
    }
    if (tag === 'fn') { return { kind: 'op', label: `fn ${exp[2]}`, children: [['group', exp[1]]] } }
    if (tag === 'self' && exp.length === 2) {
        return {
            owner: (v, port) => port.startsWith('body ') && v instanceof Array && v[0] === 'group',
            portLabel: port => `${port} (self ${exp[1]})`,
        }
    }
    if (tag === 'self') { return { owner: (v, port) => port === 'body' && v instanceof Array && v[0] === '=>' } }
    // `Op0Id` groups by operand count, not by meaning — its own doc in
    // `fjs/edag` says so. `undefined` is a primitive, where `args` and
    // `rest` are places a value enters a scope from outside it. A drawing
    // wants the meaning, so `undefined` draws as the leaf every other
    // primitive is, beside `null`, and the inputs draw as terminals of
    // their own.
    if (tag === 'undefined') { return { inline: tag } }
    if (tag === 'args' || tag === 'rest') { return { inline: tag, kind: 'terminal' } }
    // `throw` is an `op1` in the schema, but its one operand is not an
    // operand a value is computed from: it is the value the failure
    // carries, so the port says so.
    if (tag === 'throw') { return { kind: 'op', label: 'throw', children: [['value', exp[1]]] } }
    return unsupported(exp)
})

/**
 * What a module's EDAG draws as: its default export's value when that is
 * all it exports, and otherwise the module itself — the object of its
 * exports, or the failure a module that throws is.
 *
 * @type {(module: Exp) => Exp}
 */
const drawn = module => {
    const members = _moduleExports(module)
    return members.length === 1 && members[0][1] === 'default' ? _defaultExport(module) : module
}

/**
 * `text` as the EDAG its module lowers to, or the compiler's diagnostic if it
 * does not compile. An operand drawn beside a value names the node it
 * leads to, its key in the values' key column, so a node's operands line
 * up whether they are constants or nodes. A shared node is still drawn
 * once: its label in the rows of the edges into it reads as a reference to
 * the one box the edges reach.
 *
 * @type {(text: string) => Result<Graph, string>}
 */
export const graphOfText = parsed(ast => {
    const lowered = tryUnresolved(ast)
    return lowered[0] === 'error' ? lowered : ok(graphOf(_shapeOf)(drawn(lowered[1].edag)))
})
