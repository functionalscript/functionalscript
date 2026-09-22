/**
 * A FunctionalScript expression as the graph its compiler builds: type
 * `export default <expr>;`, see the EDAG — Expression DAG — [`unresolved`
 * lowers](./module.f.mjs) it to, drawn with [the shared graph
 * module](../../website/demo/graph/module.f.mjs).
 *
 * **A `const` referenced twice is one node with two incoming edges, not
 * two nodes that happen to match.** Every reference to the same `const`
 * lowers to the same `Exp` object — [`unresolved`'s own
 * doc](./module.f.mjs) says so — so `1+2` written once and used three times
 * is one operator node this graph draws once. Two `1+2`s written out
 * separately are two nodes: nothing here performs common-subexpression
 * elimination, only `const` makes sharing.
 *
 * **A container gets one node per distinct reference, an operator gets one
 * node per occurrence of its own — the same rule the DataJS demo draws,
 * for the same reason.** `Object.is` on the `Exp` value is what a
 * lowered module already carries; this walk reads it rather than
 * reconstructing it.
 *
 * **Not every `Exp` shape is drawn yet.** Optional chaining — `?.`, `?.()`,
 * and the continuation a `.` or `()` carries into the next step of a chain —
 * is its own small state machine layered on top of the ordinary node
 * shapes, and this demo does not walk it: a node it cannot describe is shown
 * as itself, not silently dropped or wrongly drawn.
 *
 * **An operand a node may never evaluate draws dashed.** `&&`, `||` and `??`
 * establish their right operand only where the left has not already
 * decided the answer, and `?:` establishes exactly one arm, so those edges
 * are marked and the shared module draws them broken. The mark is on the
 * **edge** and not on the node it reaches, because laziness is positional:
 * a node reached from an eager position elsewhere is evaluated there
 * whatever reaches it here, and a node is drawn once however many edges
 * arrive.
 *
 * **It needs no operations.** Parsing and lowering are pure functions of
 * the text, so `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Edge, Node } from '../../website/demo/graph/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { _Shape, _State } from './types.ts'
 */

import { parse } from '../transpiler/module.f.mjs'
import { lazyOp2Id } from '../../edag/module.f.mjs'
import { _defaultExport, unresolved } from './module.f.mjs'
import { ranked, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'

const { is } = Object

// The operator tag groups `fjs/edag/types.ts` names, read here rather than
// reconstructed from the compiler's own runtime schemas: a demo is allowed
// the loss of automatic drift-detection a schema import would buy, for a
// flat list of strings simple enough to check against the type file by eye.
const op0 = new Set(['undefined', 'args', 'frame'])
const op1 = new Set(['String', 'Number', '!', '~', 'typeof'])
const op2 = new Set([
    '=>', 'own', 'is',
    '===', '!==', '>', '>=', '<', '<=',
    '*', '/', '%', '**',
    '&', '|', '^', '<<', '>>', '>>>',
    '&&', '||', '??',
])
const op12 = new Set(['+', '-'])

/**
 * The `op2` tags whose **right** operand is lazy, taken from `fjs/edag` rather
 * than repeated here: the executor and this drawing have to agree about
 * which operand may go unevaluated, and a second list is the one that
 * drifts.
 *
 * Why the mark then belongs on the **edge** and not on the node it reaches:
 * `fjs/edag`'s doc again — "all this laziness is positional, not nodal — the
 * same node referenced from an eager position elsewhere is still evaluated
 * there". A node is drawn once however many references reach it, and one of
 * them being conditional says nothing about the others.
 */
const lazyRight = /** @type {ReadonlySet<string>} */ (new Set(lazyOp2Id))

/** @type {(index: unknown) => string} */
const dotLabel = index => typeof index === 'number' || typeof index === 'string'
    ? (typeof index === 'number' ? `[${index}]` : `.${index}`)
    : '.'

/**
 * `exp`'s own label and its labeled children — everything a walk needs to
 * turn one operation node into edges, without yet creating anything.
 *
 * `null` for a shape this demo does not draw: optional chaining's own tags,
 * and a `.`/`()` carrying a continuation past its ordinary operands (a
 * longer tuple than the plain two- or three-element form).
 *
 * @type {(exp: readonly unknown[]) => _Shape | null}
 */
export const _shapeOf = exp => {
    const tag = exp[0]
    if (tag === '[]') {
        const items = /** @type {readonly (readonly unknown[] | Exp)[]} */ (exp[1])
        return {
            kind: 'op', label: '[]',
            children: items.map((item, i) => item instanceof Array && item[0] === '...'
                ? [`...${i}`, /** @type {Exp} */ (item[1])]
                : [`${i}`, /** @type {Exp} */ (item)]),
        }
    }
    if (tag === '{}') {
        const props = /** @type {readonly (readonly unknown[])[]} */ (exp[1])
        return {
            kind: 'op', label: '{}',
            children: props.flatMap((p, i) => p[0] === '...'
                ? [/** @type {readonly [string, Exp]} */ ([`...${i}`, /** @type {Exp} */ (p[1])])]
                : typeof p[1] === 'string'
                    ? [/** @type {readonly [string, Exp]} */ ([p[1], /** @type {Exp} */ (p[2])])]
                    : [
                        /** @type {readonly [string, Exp]} */ ([`key${i}`, /** @type {Exp} */ (p[1])]),
                        /** @type {readonly [string, Exp]} */ ([`value${i}`, /** @type {Exp} */ (p[2])]),
                    ]),
        }
    }
    if (tag === '.') {
        if (exp.length > 3) { return null }
        const index = exp[2]
        /** @type {readonly (readonly [string, Exp])[]} */
        const indexChild = index instanceof Array
            ? [['idx', /** @type {Exp} */ (/** @type {unknown} */ (index))]]
            : []
        return { kind: 'op', label: dotLabel(index), children: [['obj', /** @type {Exp} */ (exp[1])], ...indexChild] }
    }
    if (tag === '()') {
        return {
            kind: 'op', label: '()',
            children: [['callee', /** @type {Exp} */ (exp[1])], ['arg', /** @type {Exp} */ (exp[2])]],
        }
    }
    if (tag === ',') {
        const items = /** @type {readonly Exp[]} */ (exp[1])
        return { kind: 'op', label: ',', children: items.map((item, i) => [`${i}`, item]) }
    }
    if (tag === '?:') {
        // The condition is established, then exactly one arm — so both arms
        // are lazy and neither is the operand that always runs.
        return {
            kind: 'op', label: '?:',
            children: [
                ['cond', /** @type {Exp} */ (exp[1])],
                ['then', /** @type {Exp} */ (exp[2]), 'lazy'],
                ['else', /** @type {Exp} */ (exp[3]), 'lazy'],
            ],
        }
    }
    // `=>` is an `Op2` by operand count and stays in that set above, which
    // mirrors the type file for the eye-check the comment there describes; it
    // is drawn here instead because `left`/`right` name nothing a reader of a
    // function wants, and `frame`/`body` name exactly it. The frame is `null`
    // in every function the compiler emits today — `./module.f.mjs` lowers
    // each to `['=>', null, body]`, the parser refusing a capture — and the
    // edge label is what makes that null read as the absent frame it is
    // rather than as a constant somebody passed.
    if (tag === '=>') {
        return {
            kind: 'op', label: '=>',
            children: [['frame', /** @type {Exp} */ (exp[1])], ['body', /** @type {Exp} */ (exp[2])]],
        }
    }
    if (typeof tag === 'string' && op0.has(tag)) {
        // `Op0Id` groups by operand count, not by meaning — its own doc in
        // `fjs/edag` says so: `undefined` is a constant, where `args` and
        // `frame` are the two places a value enters a scope from outside it.
        // A drawing wants the meaning, so the constant draws as the leaf it
        // is, beside `null` and every other one, and the two inputs draw as
        // terminals of their own.
        return { kind: tag === 'undefined' ? 'leaf' : 'terminal', label: tag, children: [] }
    }
    if (typeof tag === 'string' && op1.has(tag)) {
        return { kind: 'op', label: tag, children: [['operand', /** @type {Exp} */ (exp[1])]] }
    }
    if (typeof tag === 'string' && op2.has(tag)) {
        return {
            kind: 'op', label: tag,
            children: [
                ['left', /** @type {Exp} */ (exp[1])],
                lazyRight.has(tag)
                    ? ['right', /** @type {Exp} */ (exp[2]), 'lazy']
                    : ['right', /** @type {Exp} */ (exp[2])],
            ],
        }
    }
    if (typeof tag === 'string' && op12.has(tag)) {
        return exp.length === 2
            ? { kind: 'op', label: tag, children: [['operand', /** @type {Exp} */ (exp[1])]] }
            : {
                kind: 'op', label: tag,
                children: [['left', /** @type {Exp} */ (exp[1])], ['right', /** @type {Exp} */ (exp[2])]],
            }
    }
    return null
}

/** @type {(state: _State) => (ref: object) => number | null} */
const findRef = state => ref => {
    const found = state.refs.find(([r]) => is(r, ref))
    return found === undefined ? null : found[1]
}

/**
 * `exp`'s node id, and the state with `exp` and everything under it added —
 * or just the state, when `exp` is a reference already walked.
 *
 * Exported as linkage, not API: a shape `_shapeOf` refuses draws as itself
 * here rather than being dropped, and no source the parser accepts today
 * reaches that path, so it needs a hand-built `Exp` to test at all — the
 * same reason `_shapeOf` itself is exported.
 *
 * @type {(state: _State) => (exp: Exp) => { readonly id: number, readonly state: _State }}
 */
export const _walk = state => exp => {
    if (exp === null || typeof exp !== 'object') {
        const id = state.next
        /** @type {Node} */
        const node = { id, kind: 'leaf', label: concat(leafSerialize(exp)) }
        return { id, state: { ...state, next: id + 1, nodes: [...state.nodes, node] } }
    }
    const existing = findRef(state)(exp)
    if (existing !== null) { return { id: existing, state } }
    const shape = _shapeOf(exp)
    const id = state.next
    /** @type {Node} */
    const node = shape === null
        ? { id, kind: 'unsupported', label: `${exp[0]} (not yet drawn)` }
        : { id, kind: shape.kind, label: shape.label }
    /** @type {readonly [object, number]} */
    const ref = [exp, id]
    /** @type {_State} */
    const withNode = { refs: [...state.refs, ref], nodes: [...state.nodes, node], edges: state.edges, next: id + 1 }
    const final = (shape?.children ?? []).reduce((acc, [label, child, kind]) => {
        const step = _walk(acc)(child)
        return {
            ...step.state,
            edges: [...step.state.edges, { from: id, to: step.id, label, kind }],
        }
    }, withNode)
    return { id, state: final }
}

/**
 * `text` as the EDAG its default export lowers to, or the parser's own
 * error if it does not compile.
 *
 * @type {(text: string) => { readonly ok: true, readonly nodes: readonly Node[], readonly edges: readonly Edge[] } | { readonly ok: false, readonly error: string }}
 */
const graphOf = text => {
    const result = parse('')(text)
    if (result[0] === 'error') { return { ok: false, error: result[1].message } }
    const { edag } = unresolved(result[1])
    const { state } = _walk({ refs: [], nodes: [], edges: [], next: 0 })(_defaultExport(edag))
    return { ok: true, nodes: state.nodes, edges: state.edges }
}

/**
 * The state is the text itself, not the graph: the graph is a function of
 * it, and storing a value the state can already compute is how the two
 * drift apart.
 *
 * The initial source carries this demo's whole reason for existing. `a` is
 * referenced three times — twice in the array, once inside `a * 3` — and
 * every reference is the same `Exp` object, so the `+` node draws once with
 * three incoming edges.
 *
 * It carries one of every look the drawing has, too, so that what the
 * three mean is on screen before a reader has typed anything. The numbers
 * and `undefined` are constants, dashed. The two `args` are filled
 * terminals — a value arriving from outside a scope rather than computed
 * from operands below — and there are two of them because a node belongs
 * to one scope: the module's, which its import reaches through
 * `.default` on argument 0, and the function's own, fresh for that
 * body. That those two look identical and are still not shared is `a`'s
 * lesson from the other side: sharing is reference identity, never
 * resemblance. The function's `frame` edge ends at `null` because the
 * compiler emits no captures yet.
 *
 * **`m && a` is what makes the marking legible**, and not because it
 * draws one dashed line. `a` is reached four times — twice by the array,
 * once through `a * 3`, and once as that `&&`'s right operand — so one
 * node carries three solid edges and one broken one. That is laziness
 * being positional rather than nodal, in a picture: the node *is*
 * evaluated, because three references want it whatever the fourth
 * decides, and a mark on the box could not have said which of the four
 * was the conditional one.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = {
    init: 'import m from "./m.f.js";\nconst a = 1 + 2;\nexport default [a, a, a * 3, m && a, (...x) => x, undefined];',
    update: state => event => pureOk(event.kind === 'input' ? event.value : state),
    view: text => {
        const g = graphOf(text)
        return ['div',
            ['p',
                ['label', { for: 'edag' }, 'Source '],
                ['textarea', { id: 'edag', name: 'edag', rows: '8' }, text],
            ],
            g.ok ? graphSvg({ nodes: ranked(g.nodes, g.edges), edges: g.edges }) : ['p', `Error: ${g.error}`],
        ]
    },
}
