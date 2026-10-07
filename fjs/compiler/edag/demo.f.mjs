/**
 * A FunctionalScript expression as the graph its compiler builds: type
 * `export default <expr>;`, see the EDAG — Expression DAG — [`unresolved`
 * lowers](./module.f.mjs) it to, drawn with [the shared graph
 * module](../../website/demo/graph/module.f.mjs).
 *
 * **A module with named exports draws as the object of its exports.** Only
 * a module whose one export is its default draws as that value: reading
 * `.default` off any other would draw a value the source never wrote —
 * `undefined` for `export const a = []`.
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
 * **A method call is one node.** `o.f(x)` lowers to a `.` carrying its call
 * as a continuation, `['.', o, 'f', ['|()', [x]]]`, not to a `()` over a
 * `.`: the receiver stays live into the call rather than becoming a value
 * of its own, and a drawing with two nodes would show a value the EDAG never
 * has. So it draws as one node, labelled `.f()`, with the receiver in its
 * `obj` port and the arguments numbered after it as a plain call's are.
 *
 * **Not every `Exp` shape is drawn yet.** Optional chaining — `?.`, `?.()`,
 * and the continuations that keep a chain inside its short-circuit region —
 * is its own small state machine layered on top of the ordinary node
 * shapes, and this demo does not walk it: a node it cannot describe is shown
 * as itself, not silently dropped or wrongly drawn.
 *
 * **A primitive or an input draws inside the node that uses it.** A
 * number, a string, a boolean, a bigint, `null` or `undefined` is not a
 * node of its own but a value in its user's port, beside the operand's role; so is a scope's input —
 * `args`, `rest`, `arg n`, `frame n` — marked as the terminal it is. Only an
 * expression that is one of these and nothing else draws one as a node,
 * having no user to sit in.
 *
 * "Primitive" is JavaScript's word here, which counts `undefined` among
 * them. The EDAG's own `Primitive` type does not: it holds `undefined` as
 * the zero-operand operator `['undefined']`. This demo draws the two alike,
 * because a reader sees the same value either way.
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
 * @import { Primitive } from '../../media/datajs/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Graph, Shape } from '../../website/demo/graph/types.ts'
 * @import { Examples } from '../../website/demo/examples/types.ts'
 */

import { parse } from '../transpiler/module.f.mjs'
import { lazyOp2Id } from '../../edag/module.f.mjs'
import { _defaultExport, _moduleExports, unresolved } from './module.f.mjs'
import { graphOf, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'

// The operator tag groups `fjs/edag/types.ts` names, read here rather than
// reconstructed from the compiler's own runtime schemas: a demo is allowed
// the loss of automatic drift-detection a schema import would buy, for a
// flat list of strings simple enough to check against the type file by eye.
const op0 = new Set(['undefined', 'args', 'rest', 'self'])
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
 * A node this demo does not draw — optional chaining's own tags, and a `.`
 * whose continuation is an optional call rather than a plain one — drawn
 * as itself, labelled by its tag, rather than silently dropped or wrongly
 * drawn.
 *
 * @type {(exp: readonly unknown[]) => Shape<unknown>}
 */
const unsupported = exp => ({ kind: 'unsupported', label: `${exp[0]} (not yet drawn)`, children: [] })

/**
 * The ports of an item list, an `[]` node's and a call's arguments alike:
 * one per item, numbered by position, a spread's marked `...`.
 *
 * @type {(items: unknown) => readonly (readonly [string, Exp])[]}
 */
const itemChildren = items => /** @type {readonly (readonly unknown[] | Exp)[]} */ (items).map((item, i) =>
    item instanceof Array && item[0] === '...'
        ? [`...${i}`, /** @type {Exp} */ (item[1])]
        : [`${i}`, /** @type {Exp} */ (item)])

/**
 * How the walk reads one `Exp`: an operation node, with its own label and
 * its labeled children, or a value drawn inline in its user's port.
 *
 * **A primitive or an input is inline.** A primitive — an EDAG
 * `Primitive`, or the `undefined` operator — is a plain value, and a
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
export const _shapeOf = e => {
    if (e === null || typeof e !== 'object') { return { inline: concat(leafSerialize(/** @type {Primitive} */ (e))) } }
    const exp = /** @type {readonly unknown[]} */ (e)
    const tag = exp[0]
    if (tag === '[]') { return { kind: 'op', label: '[]', children: itemChildren(exp[1]) } }
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
        const index = exp[2]
        /** @type {readonly (readonly [string, Exp])[]} */
        const indexChild = index instanceof Array
            ? [['idx', /** @type {Exp} */ (/** @type {unknown} */ (index))]]
            : []
        /** @type {readonly (readonly [string, Exp])[]} */
        const receiver = [['obj', /** @type {Exp} */ (exp[1])], ...indexChild]
        if (exp.length === 3) { return { kind: 'op', label: dotLabel(index), children: receiver } }
        // The one continuation a `.` outside a short-circuit region can
        // carry besides a plain call is an optional call, which opens a
        // region this demo does not walk.
        const step = /** @type {readonly unknown[]} */ (exp[3])
        return step[0] === '|()'
            ? { kind: 'op', label: `${dotLabel(index)}()`, children: [...receiver, ...itemChildren(step[1])] }
            : unsupported(exp)
    }
    if (tag === '()') {
        return { kind: 'op', label: '()', children: [['callee', /** @type {Exp} */ (exp[1])], ...itemChildren(exp[2])] }
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
    // Length is metadata, while frame and lazy body are expression edges;
    // a fixed parameter and a frame slot are inputs, their index metadata.
    if (tag === 'arg') { return { inline: `arg ${exp[1]}`, kind: 'terminal' } }
    if (tag === 'frame') { return { inline: `frame ${exp[1]}`, kind: 'terminal' } }
    if (tag === '=>') {
        // One port per slot, named as the body's read of it is, and the
        // body after them: a function that captures nothing has no frame
        // port at all.
        return {
            kind: 'op', label: `=> (${exp[1]})`,
            children: [
                .../** @type {readonly Exp[]} */ (exp[2]).map((slot, i) => /** @type {readonly [string, Exp]} */ ([`frame ${i}`, slot])),
                ['body', /** @type {Exp} */ (exp[3]), 'lazy'],
            ],
        }
    }
    if (typeof tag === 'string' && op0.has(tag)) {
        // `Op0Id` groups by operand count, not by meaning — its own doc in
        // `fjs/edag` says so. `undefined` is a primitive, where `args` and
        // `rest` are places a value enters a scope from outside it. A
        // drawing wants the meaning, so `undefined` draws as the leaf every
        // other primitive is, beside `null`, and the inputs draw as
        // terminals of their own.
        return tag === 'undefined' ? { inline: tag } : { inline: tag, kind: 'terminal' }
    }
    // `throw` is an `op1` in the schema, but its one operand is not an
    // operand a value is computed from: it is the value the failure
    // carries, so the port says so.
    if (tag === 'throw') {
        return { kind: 'op', label: 'throw', children: [['value', /** @type {Exp} */ (exp[1])]] }
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
    return unsupported(exp)
}

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
 * `text` as the EDAG its module lowers to, or the parser's own error if it
 * does not compile.
 *
 * @type {(text: string) => ({ readonly ok: true } & Graph) | { readonly ok: false, readonly error: string }}
 */
export const _graphOf = text => {
    const result = parse('')(text)
    return result[0] === 'error'
        ? { ok: false, error: result[1].message }
        : { ok: true, ...graphOf(_shapeOf)(drawn(unresolved(result[1]).edag)) }
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
 * and `undefined` are primitives, tinted cells inside the ports that use
 * them. `args` and `rest` are inputs, filled grey cells: a value arriving
 * from outside a scope rather than computed from operands. `args` is the
 * module's, which its import reaches through `.default` on argument 0,
 * and `rest` the function's own. The function has no frame port because
 * it captures nothing, and its `body` port is broken because building the
 * function does not run it.
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
 * The other thirteen take one point each, on its own:
 *
 * - **Sharing** sets a `const` used twice beside the same expression
 *   written out again: only `const` makes sharing, so that is one `+` node
 *   with two edges and a second `+` of its own.
 * - **Primitives** puts every kind of primitive — `null`, `undefined`, a
 *   boolean, a number, a bigint, a string — inline in the port that uses it.
 *   A hexadecimal number and bigint are there too, drawn as the values they
 *   spell, `255` and `16n`: the graph keeps the value, not the spelling.
 * - **Operators** draws arithmetic, unary, comparison and bitwise operators
 *   over a function's two parameters.
 * - **Laziness: `&&` `||` `??`** breaks each one's right edge, and
 *   **Laziness: `?:`** both arms and not the condition — with a function's
 *   body in each, every lazy position the compiler has.
 * - **Closures** is a function that captures its enclosing parameter, read
 *   inside the body through a frame slot.
 * - **Objects and properties** draws an object's keys as its ports and a
 *   property read, by name or by a string index, as a `.` node.
 * - **Imports and calls** reaches a default and a named import through the
 *   module's `args`, and calls one with the other.
 * - **Named exports** draws the module as the object of its exports, each
 *   a port: a module that is not only a default is that object, and there
 *   is no `.default` to read off it.
 * - **Comma** is an unused `const` the compiler keeps as an `anchor`,
 *   beside the `result` the module is.
 * - **Throw** is a function whose block body ends in `throw` rather than
 *   `return`: the body is the `throw` node, its port the value the failure
 *   carries, and the function's `body` edge is broken as every function's
 *   is, since making the function does not run it.
 * - **Guard** is a body of two `if`s that return early: each is a `?:`
 *   node, the statements after a guard its alternate, so the drawing has
 *   no `if` in it — the statement is sugar over the conditional, and the
 *   graph is the one `n < 0 ? -1 : n > 0 ? 1 : 0` draws.
 * - **Parse error** does not parse, because an error is something this
 *   demo shows too.
 *
 * @type {Examples}
 */
export const examples = [
    ['Overview', 'import m from "./m.f.js";\nconst a = 1 + 2;\nconst checked = m.x < 4;\nexport default [a, a, a * 3, m && a, (...x) => x, undefined];'],
    ['Sharing: a const, not a repeated expression', 'const a = 1 + 2;\nconst b = 1 + 2;\nexport default [a, a, b];'],
    ['Primitives', 'export default [null, undefined, true, 1, 0xFF, 2n, 0x10n, "s"];'],
    ['Operators', 'export default (a, b) => [a + b, a * b, a ** b, -a, ~a, a === b, a < b, a & b, a << b];'],
    ['Laziness: && || ??', 'export default (...a) => [a[0] && a[1], a[0] || a[1], a[0] ?? a[1]];'],
    ['Laziness: ?:', 'export default (...a) => a[0] ? a[1] : a[2];'],
    ['Closures: parameters and frame', 'export default x => y => x * 2 + y;'],
    ['Objects and properties', 'const o = { a: 1, "b c": [2, 3] };\nexport default [o.a, o["b c"][1]];'],
    ['Imports and calls', 'import m from "./m.f.js";\nimport { x } from "./n.f.js";\nexport default m(x);'],
    ['Named exports', 'export const a = [];\nexport const f = x => [a, x];'],
    ['Comma: an anchored const', 'import m from "./m.f.js";\nconst checked = m.x;\nexport default 42;'],
    ['Throw: a function that fails', 'export default (...a) => {\n    const reason = ["not implemented", a[0]];\n    throw reason;\n};'],
    ['Guard: an if that returns early', 'export default (n) => {\n    if (n < 0) { return -1; }\n    if (n > 0) { return 1; }\n    return 0;\n};'],
    ['Parse error', 'export default {bad'],
]

/**
 * The state is the text itself, not the graph: the graph is a function of
 * it, and storing a value the state can already compute is how the two
 * drift apart. Picking an example replaces the text with its source.
 *
 * The picker is built once, as the module loads, which is where a list
 * with a repeated name or source is refused.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({ name: 'edag', label: 'Source', init: examples[0][1], examples })(text => {
    const g = _graphOf(text)
    return [g.ok ? graphSvg(g) : ['p', `Error: ${g.error}`]]
})
