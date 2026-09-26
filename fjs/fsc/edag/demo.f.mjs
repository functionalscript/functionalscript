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
 * **A constant or an input draws inside the node that uses it.** A number,
 * a string, `null` or `undefined` is not a node of its own but a value in
 * its user's port, beside the operand's role; so is a scope's input —
 * `args`, `rest`, `frame`, `arg n` — marked as the terminal it is. Only an
 * expression that is one of these and nothing else draws one as a node,
 * having no user to sit in.
 *
 * **An operand a node may never evaluate draws dashed.** `&&`, `||` and `??`
 * establish their right operand only where the left has not already
 * decided the answer, `?:` establishes exactly one arm, and `=>` builds a
 * closure without running its body, so those edges are marked and the
 * shared module draws them broken. The mark is on the
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
 * @import { Edge, Inline, Node } from '../../website/demo/graph/types.ts'
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
const op0 = new Set(['undefined', 'args', 'frame', 'rest'])
const op1 = new Set(['String', 'Number', '!', '~', 'typeof'])
const op2 = new Set([
    'own', 'is',
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
        // **A comma's operands are not alike, and numbering them says they
        // are.** `fjs/edag`'s own doc: it "establishes all of its operands
        // and takes the value of the last one; the earlier operands exist
        // for their throw-potential only — the anchors of computations whose
        // value nothing takes". Five edges labelled `0` to `4` show five
        // equals where one is the answer and four only have to happen.
        //
        // The names carry that and the drawing carries the order, which is
        // what the numbers were really for: the operands sit left to right
        // as they were written.
        const last = items.length - 1
        return {
            kind: 'op', label: ',',
            children: items.map((item, i) => [i === last ? 'result' : 'anchor', item]),
        }
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
    // Length is metadata, while frame and lazy body are expression edges.
    if (tag === 'arg') { return { kind: 'terminal', label: `arg ${exp[1]}`, children: [] } }
    if (tag === '=>') {
        return {
            kind: 'op', label: `=> (${exp[1]})`,
            children: [
                ['frame', /** @type {Exp} */ (exp[2])],
                ['body', /** @type {Exp} */ (exp[3]), 'lazy'],
            ],
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

/**
 * `exp` as a value the drawing puts inline in its user's port, or `null`
 * for one that is a node of its own. A constant — a primitive, or the
 * `undefined` operator — is inline, and so is a terminal, marked as one.
 *
 * **A terminal's identity is its scope's**, so drawing it inline loses
 * nothing. `args`, `rest`, `frame` and `arg n` are the values a scope
 * receives from outside it, and every reference to one inside a body is
 * that body's own: one scope never reaches another's inputs except through
 * `frame`. A node with several arrows into it would only restate what the
 * reference's position already says. Operators, even childless ones like
 * an empty `[]`, stay nodes: two of those are two values.
 *
 * @type {(exp: Exp) => Inline | null}
 */
const inlineOf = exp => {
    if (exp === null || typeof exp !== 'object') { return { inline: concat(leafSerialize(exp)) } }
    const shape = _shapeOf(exp)
    return shape === null ? null
        : shape.kind === 'leaf' ? { inline: shape.label }
            : shape.kind === 'terminal' ? { inline: shape.label, kind: 'terminal' }
                : null
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
        const inline = inlineOf(child)
        if (inline !== null) {
            return { ...acc, edges: [...acc.edges, { from: id, to: inline, label, kind }] }
        }
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
export const _graphOf = text => {
    const result = parse('')(text)
    if (result[0] === 'error') { return { ok: false, error: result[1].message } }
    const { edag } = unresolved(result[1])
    const { state } = _walk({ refs: [], nodes: [], edges: [], next: 0 })(_defaultExport(edag))
    return { ok: true, nodes: state.nodes, edges: state.edges }
}

/**
 * The sources the examples drop-down offers, each under the name it is
 * picked by: one per thing the drawing has to say, so a reader can see
 * each without first working out how to write it.
 *
 * **The first is the overview**, and the demo opens on it. `a` is
 * referenced four times — twice in the array, once inside `a * 3`, once as
 * `m && a`'s right operand — and every reference is the same `Exp` object,
 * so the `+` node draws once with four incoming edges.
 *
 * It carries one of every look the drawing has, too, so that what the
 * three mean is on screen before a reader has picked anything. The numbers
 * and `undefined` are constants, tinted cells inside the ports that use
 * them. `args` and `rest` are inputs, filled grey cells: a value arriving
 * from outside a scope rather than computed from operands. `args` is the
 * module's, which its import reaches through `.default` on argument 0,
 * and `rest` the function's own. The function's `frame` port holds `null`
 * because it captures nothing, and its `body` port is broken because
 * building the function does not run it.
 *
 * **`m && a` is what makes the marking legible**, and not because it
 * draws one dashed line. `a` is reached four times — twice by the array,
 * once through `a * 3`, and once as that `&&`'s right operand — so one
 * node carries three solid lines and one broken, each leaving a port of
 * its own. That is laziness being positional rather than nodal, in a
 * picture: the node *is* evaluated, because three references want it
 * whatever the fourth decides, and a mark on the box could not have said
 * which of the four was the conditional one.
 *
 * `checked` is the one thing the export does not reach, so the compiler
 * anchors it with a comma and the whole module is that comma's result.
 * Its two edges carry the roles a number could not: `anchor` for a
 * computation that only has to happen — reading `.x` off the import can
 * throw, which is why it is kept — and `result` for the value the module
 * is. It reads `m` rather than `a`, so `a` keeps the four references the
 * paragraph above counts.
 *
 * The other ten take one point each, on its own:
 *
 * - **Sharing** sets a `const` used twice beside the same expression
 *   written out again: only `const` makes sharing, so that is one `+` node
 *   with two edges and a second `+` of its own.
 * - **Constants** puts every kind of constant — `null`, `undefined`, a
 *   boolean, a number, a bigint, a string — inline in the port that uses it.
 * - **Operators** draws arithmetic, unary, comparison and bitwise operators
 *   over a function's two parameters.
 * - **Laziness: `&&` `||` `??`** breaks each one's right edge, and
 *   **Laziness: `?:`** both arms and not the condition — with a function's
 *   body in each, every lazy position the compiler has.
 * - **Closures** is a function that captures its enclosing parameter, read
 *   inside the body through `frame`.
 * - **Objects and properties** draws an object's keys as its ports and a
 *   property read, by name or by a string index, as a `.` node.
 * - **Imports and calls** reaches a default and a named import through the
 *   module's `args`, and calls one with the other.
 * - **Comma** is an unused `const` the compiler keeps as an `anchor`,
 *   beside the `result` the module is.
 * - **Parse error** does not parse, because an error is something this
 *   demo shows too.
 *
 * @type {readonly (readonly [name: string, source: string])[]}
 */
export const examples = [
    ['Overview', 'import m from "./m.f.js";\nconst a = 1 + 2;\nconst checked = m.x < 4;\nexport default [a, a, a * 3, m && a, (...x) => x, undefined];'],
    ['Sharing: a const, not a repeated expression', 'const a = 1 + 2;\nconst b = 1 + 2;\nexport default [a, a, b];'],
    ['Constants', 'export default [null, undefined, true, 1, 2n, "s"];'],
    ['Operators', 'export default (a, b) => [a + b, a * b, a ** b, -a, ~a, a === b, a < b, a & b, a << b];'],
    ['Laziness: && || ??', 'export default (...a) => [a[0] && a[1], a[0] || a[1], a[0] ?? a[1]];'],
    ['Laziness: ?:', 'export default (...a) => a[0] ? a[1] : a[2];'],
    ['Closures: parameters and frame', 'export default x => y => x * 2 + y;'],
    ['Objects and properties', 'const o = { a: 1, "b c": [2, 3] };\nexport default [o.a, o["b c"][1]];'],
    ['Imports and calls', 'import m from "./m.f.js";\nimport { x } from "./n.f.js";\nexport default m(x);'],
    ['Comma: an anchored const', 'import m from "./m.f.js";\nconst checked = m.x;\nexport default 42;'],
    ['Parse error', 'export default {bad'],
]

/**
 * The examples drop-down, with the example `text` is selected — or, once a
 * reader has edited it into something that is none of them, a `Custom`
 * entry that is. Which one is selected is read off the text rather than
 * stored beside it, for the same reason the graph is.
 *
 * @type {(text: string) => Element}
 */
const examplePicker = text => {
    /** @type {readonly Element[]} */
    const options = examples.map(([name, source]) =>
        ['option', source === text ? { value: name, selected: '' } : { value: name }, name])
    const custom = examples.some(([, source]) => source === text)
        ? []
        : [/** @type {Element} */ (['option', { value: '', selected: '' }, 'Custom'])]
    return ['p',
        ['label', { for: 'example' }, 'Example '],
        ['select', { id: 'example', name: 'example' }, ...custom, ...options],
    ]
}

/**
 * The state is the text itself, not the graph: the graph is a function of
 * it, and storing a value the state can already compute is how the two
 * drift apart. Picking an example replaces the text with its source, and a
 * name no example has — `Custom`'s empty one — leaves it as it is.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = {
    init: examples[0][1],
    update: state => event => pureOk(event.kind !== 'input' ? state
        : event.name === 'example' ? examples.find(([name]) => name === event.value)?.[1] ?? state
            : event.value),
    view: text => {
        const g = _graphOf(text)
        return ['div',
            examplePicker(text),
            ['p',
                ['label', { for: 'edag' }, 'Source '],
                ['textarea', { id: 'edag', name: 'edag', rows: '8' }, text],
            ],
            g.ok ? graphSvg({ nodes: ranked(g.nodes, g.edges), edges: g.edges }) : ['p', `Error: ${g.error}`],
        ]
    },
}
