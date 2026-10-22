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
 * **A property read draws its key as a value.** `a.x` is a `.` node with
 * the receiver in its `obj` port and the key in its `key` port, `"x"`;
 * `a[5]` is the same `.` with the index in its `idx` port, `5`. A computed
 * index, `a[Number(i)]`, is an edge from `idx` to the node it is. A function
 * is a `=>` node with its length in its `length` port.
 *
 * **A method call is one node.** `o.f(x)` lowers to a `.` carrying its call
 * as a continuation, `['.', o, 'f', ['|()', [x]]]`, not to a `()` over a
 * `.`: the receiver stays live into the call rather than becoming a value
 * of its own, and a drawing with two nodes would show a value the EDAG never
 * has. So it draws as one node, **a table of its links**: a cell per link
 * holding its operator, beside that link's rows, each row a role and its
 * value or arrow, as every node's are. The `.` link has two, the receiver in
 * `obj` and the key `"f"` in `key`, as a plain `o.f` draws, and the `()` link one, its
 * arguments in `...`, an arrow to the `[]` node they are drawn as. A call's
 * arguments are one node, as an array literal's items are, rather than a
 * port each: two calls in one chain would otherwise both have a `0`. A plain
 * call, `f(x)`, is the same one link, `callee` and `...`. The node's label
 * still spells the chain, `.f()`, and is what a row of another node names it
 * by.
 *
 * **An optional chain is one node too, and its region is on the edges.**
 * `a?.b.c?.(x)` lowers to one `?.` node carrying its steps as its
 * continuation — `fjs/edag/README.md`, Chains — so it draws as one table:
 * `?.` beside `obj` and `key`, `.` beside `key`, `?.()` beside `...`. The
 * first link always takes two rows, receiver and key, as a plain `a.b` does;
 * a guarded call, `f?.(x)`, starts with `?.()` beside `callee` and `...`. A
 * numbered key is a value in its link's `idx` row and a computed one an
 * arrow from it. Everything after a `?.`
 * is skipped when the value before it is nullish, so those edges are
 * broken: a guarded call's arguments and every step's after it, and a
 * guarded access's computed key. The receiver, a plain method call's
 * arguments and the arguments of a call whose parentheses ended the region,
 * `(a?.b)(x)`, run regardless and draw solid; that call's link is `(?.)()`,
 * since the parentheses are the one thing that tells it from `a?.b(x)`.
 *
 * **A tag this demo has no shape for is drawn as itself**, labelled by the
 * tag, rather than silently dropped or wrongly drawn.
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
 * **An operand a node may never evaluate draws dashed.** Source logical
 * operators become conditional regions: `?:` establishes exactly one arm,
 * reusing the established left value where it decides the result. `=>` builds a
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
 * @import { Result } from '../../types/result/types.ts'
 * @import { _Chain, _Child } from './private.ts'
 */

import { intrinsicIds, staticIds } from '../../edag/module.f.mjs'
import { _defaultExport, _moduleExports, unresolved } from './module.f.mjs'
import { graphOf, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { refusal } from '../../website/demo/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { parsed, stageDemo } from '../stage_demo/module.f.mjs'
import { chunksText } from '../../text/marked/module.f.mjs'

// The operator tag groups `fjs/edag/types.ts` names, read here rather than
// reconstructed from the compiler's own runtime schemas: a demo is allowed
// the loss of automatic drift-detection a schema import would buy, for a
// flat list of strings simple enough to check against the type file by eye.
// The static functions are the one group a later row grows, so they are
// the EDAG's own list.
const op0 = new Set(['undefined', 'args', 'rest', 'self', 'entry', 'hasEntry', ...intrinsicIds, ...staticIds])
const op1 = new Set(['String', 'Number', '!', '~', 'typeof'])
const op2 = new Set([
    '===', '!==', '>', '>=', '<', '<=',
    '*', '/', '%', '**',
    '&', '|', '^', '<<', '>>', '>>>',
])
const op12 = new Set(['+', '-'])


/**
 * A key as a chain spells it: a name, a numbered index, or `[]` for a
 * computed one, whose value is an `idx` row of its own.
 *
 * @type {(index: unknown) => string}
 */
const keyLabel = index => typeof index === 'string' ? index : typeof index === 'number' ? `[${index}]` : '[]'

/** A plain access's spelling: `.x`, `[0]`, or `[]`. @type {(index: unknown) => string} */
const dotLabel = index => typeof index === 'string' ? `.${index}` : keyLabel(index)

/**
 * A node this demo has no shape for, drawn as itself, labelled by its tag,
 * rather than silently dropped or wrongly drawn.
 *
 * @type {(exp: readonly unknown[]) => Shape<unknown>}
 */
const unsupported = exp => ({ kind: 'unsupported', label: `${exp[0]} (not yet drawn)`, children: [] })

/** An edge, marked where its position is lazy. @type {(label: string, value: Exp, lazy: boolean) => _Child} */
const edge = (label, value, lazy) => lazy ? [label, value, 'lazy'] : [label, value]

/**
 * The ports of an `[]` node's items: one per item, named by its position,
 * a spread's marked `...`.
 *
 * @type {(items: unknown) => readonly _Child[]}
 */
const numbered = items => /** @type {readonly (readonly unknown[] | Exp)[]} */ (items).map((item, i) =>
    item instanceof Array && item[0] === '...'
        ? [`...${i}`, /** @type {Exp} */ (item[1])]
        : [`${i}`, /** @type {Exp} */ (item)])

/**
 * A call's arguments as the one `[]` node they are drawn as, in a `...`
 * row: a port per argument would give two calls in one chain the same
 * `0`, and a spread is the `[]`'s own.
 *
 * @type {(items: unknown, lazy: boolean) => _Child}
 */
const argsRow = (items, lazy) => edge('...', /** @type {Exp} */ (['[]', items]), lazy)

/**
 * A link's key as its row, as a plain `.` node draws it: a name a value in
 * its `key` row, and an index, literal or computed, in its `idx` row — a
 * computed one an edge, lazy inside a region.
 *
 * @type {(index: unknown, lazy: boolean) => _Child}
 */
const keyRow = (index, lazy) =>
    edge(typeof index === 'string' ? 'key' : 'idx', /** @type {Exp} */ (index), lazy && index instanceof Array)

/**
 * A chain's steps, each a link of its own in the node its first link
 * began: one row, beside a cell holding the link's operator — `.` with its
 * key, `()` or `?.()` with its arguments, and `(?.)()` for a call whose
 * parentheses closed the region. The node's label spells the chain for the
 * rows that name it, `?.b.c()`.
 *
 * Once a `?.` has been passed, every operand after it is one a nullish
 * value skips and draws lazy — a guarded call's own arguments included —
 * until a closing call's parentheses end the region: its arguments run
 * regardless.
 *
 * @type {(chain: _Chain) => (step: unknown) => Shape<unknown>}
 */
const steps = chain => step => {
    if (step === undefined) { return { kind: 'op', label: chain.label, children: chain.children, groups: chain.groups } }
    const [tag, x, next] = /** @type {readonly unknown[]} */ (step)
    /** @type {(op: string, label: string, row: _Child, lazy: boolean) => Shape<unknown>} */
    const link = (op, label, row, lazy) =>
        steps({ label, children: [...chain.children, row], groups: [...chain.groups, [op, 1]], lazy })(next)
    if (tag === '|.') { return link('.', chain.label + dotLabel(x), keyRow(x, chain.lazy), chain.lazy) }
    const guarded = tag === '|?.()'
    const closing = tag === '|!()'
    const lazy = !closing && (chain.lazy || guarded)
    const op = closing ? '(?.)()' : guarded ? '?.()' : '()'
    return link(op, closing ? `(${chain.label})()` : `${chain.label}${guarded ? '?.()' : '()'}`, argsRow(x, lazy), lazy)
}

/**
 * A chain — an access, plain or guarded, a guarded call, and the steps
 * any of them carries — drawn as the one node it is, a table of its
 * links, {@link steps}. The first link takes two rows, so that every arrow
 * has its name beside it: an access's receiver in `obj` and its key, or a
 * guarded call's callee in `callee` and its arguments.
 *
 * @type {(exp: readonly unknown[]) => Shape<unknown>}
 */
const chain = exp => {
    const [tag, base, x, step] = exp
    if (tag === '?.()') {
        return steps({
            label: '?.()',
            children: [['callee', /** @type {Exp} */ (base)], argsRow(x, true)],
            groups: [['?.()', 2]],
            lazy: true,
        })(step)
    }
    const guarded = tag === '?.'
    // A plain access with nothing after it is a `.` node of its own, its key
    // a value in its `key` row or its index in its `idx`.
    if (!guarded && step === undefined) {
        return { kind: 'op', label: '.', children: [['obj', /** @type {Exp} */ (base)], keyRow(x, false)] }
    }
    return steps({
        label: guarded ? `?.${keyLabel(x)}` : dotLabel(x),
        children: [['obj', /** @type {Exp} */ (base)], keyRow(x, guarded)],
        groups: [[guarded ? '?.' : '.', 2]],
        lazy: guarded,
    })(step)
}

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
    if (e === null || typeof e !== 'object') { return { inline: chunksText(leafSerialize(/** @type {Primitive} */ (e))) } }
    const exp = /** @type {readonly unknown[]} */ (e)
    const tag = exp[0]
    if (tag === '[]') { return { kind: 'op', label: '[]', children: numbered(exp[1]) } }
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
    if (tag === '.' || tag === '?.' || tag === '?.()') { return chain(exp) }
    if (tag === '()') {
        return { kind: 'op', label: '()', children: [['callee', /** @type {Exp} */ (exp[1])], argsRow(exp[2], false)] }
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
                ['length', /** @type {Exp} */ (exp[1])],
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
                ['right', /** @type {Exp} */ (exp[2])],
            ],
        }
    }
    // an instance check: its one operand, and the constructor as part of
    // the label, a name the node carries rather than a child
    if (tag === 'instanceof') {
        return { kind: 'op', label: `instanceof ${exp[2]}`, children: [['operand', /** @type {Exp} */ (exp[1])]] }
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
 * does not compile. An operand drawn beside a value names the node it
 * leads to, its key in the values' key column, so a node's operands line
 * up whether they are constants or nodes. A shared node is still drawn
 * once: its label in the rows of the edges into it reads as a reference to
 * the one box the edges reach.
 *
 * @type {(text: string) => Result<Graph, string>}
 */
export const graphOfText = parsed(ast => ok(graphOf(_shapeOf)(drawn(unresolved(ast).edag))))

/**
 * The drop-down is [the compiler's shared list](../examples/module.f.js), one
 * program followed down the pipeline: a program picked here is found under
 * the same name on the tokenizer's, parser's, serializer's, Rust and
 * side-by-side pages. What this drawing makes of the ones written for it:
 *
 * **The overview, which the demo opens on, carries one of every look the
 * drawing has.** `a` is referenced six times — twice in the array, once each
 * inside `a * 3`, `a < 4` and `a.x`, and once as `&&`'s right operand — and
 * every reference is the same `Exp` object, so the `+` node draws once with
 * six incoming edges, five solid and one broken. That is laziness being
 * positional rather than nodal, in a picture: the node *is* evaluated,
 * because five references want it whatever the sixth decides, and a mark on
 * the box could not have said which of the six was the conditional one. The
 * numbers and `undefined` are primitives, tinted cells inside the ports that
 * use them. `rest` is an input, a filled grey cell: a value arriving from
 * outside a scope rather than computed from operands. The function's
 * `length` is a value, `1`; it has no frame port because it captures
 * nothing, and its `body` port is broken
 * because building the function does not run it. `checked` is the one thing
 * the export does not reach, so the compiler anchors it with a comma and the
 * whole module is that comma's result. Its two edges carry the roles a
 * number could not: `anchor` for a computation that only has to happen —
 * reading a property can throw, which is why it is kept — and `result` for
 * the value the module is.
 *
 * - **Sharing: a repeated expression** sets a `const` used twice beside the
 *   same expression written out again: only `const` makes sharing, so that
 *   is one `+` node with two edges and a second `+` of its own.
 * - **Primitives** puts every kind inline in the port that uses it. The
 *   hexadecimal number and bigint draw as the values they spell, `255` and
 *   `16n`: the graph keeps the value, not the spelling.
 * - **Laziness: `&&` `||` `??`** draws the conditional regions each source
 *   operation becomes. **Laziness: `?:`** marks both arms and keeps the
 *   condition eager; a function's body is a lazy edge of its own.
 * - **Closure** is a function that captures its enclosing parameter and a
 *   module `const`, each read inside the body through a frame slot.
 * - **Methods and properties** draws a method call as one node of two
 *   links: `.` beside the receiver in `obj` and `"at"` in `key`, and `()`
 *   beside its arguments, a `[]` node.
 * - **Optional chaining** draws each chain as one node, a cell per link:
 *   `o?.a.b` is `?.` beside `obj` and `key`, then `.` beside `key`, `n?.a.b`
 *   the same over `null`, `o.f?.(2)` a `.` link and a `?.()` link whose
 *   `...` edge is broken — the argument is inside the region the guard
 *   opens — and `n?.(2)` one `?.()` link over a `null` callee. `(o?.a).b`
 *   is a `.` node over a `?.` node: the parentheses ended the region, so the
 *   access after them is a node of its own, where `o?.a.b` is one.
 * - **Optional chaining: a long chain** is the table at length:
 *   `o?.a.f(1)[Number(i)].length` is one node of six rows — `?.` beside
 *   `obj` and `key`, then `.` beside `key`, `()` beside `...`, `.` beside
 *   its broken `idx` edge, and `.` beside `key` — and `(o?.a.f)(...[i, 2])` ends with a `(?.)()` link whose
 *   arguments, a `[]` node with its spread, run regardless and draw solid.
 * - **Named exports** draws the module as the object of its exports, each
 *   a port: a module that is not only a default is that object, and there
 *   is no `.default` to read off it.
 * - **An import** reaches the import through the module's `args`, and
 *   **A named import and a call** calls one import with another.
 * - **Throw** is a function whose block body ends in `throw` rather than
 *   `return`: the body is the `throw` node, its port the value the failure
 *   carries, and the function's `body` edge is broken as every function's
 *   is, since making the function does not run it.
 * - **Early return** is a body of two `if`s that return early: each is a
 *   `?:` node, the statements after a guard its alternate, so the drawing
 *   has no `if` in it — the statement is sugar over the conditional, and
 *   the graph is the one `n < 0 ? -1 : n > 0 ? 1 : 0` draws.
 * - **Switch** is a body that is one `switch` over three cases: a `?:`
 *   node per case, its condition the `===` of the discriminant — one node,
 *   read by every test — and a label, two labels joined by a conditional, the next
 *   case its alternate and the `default` block the last, a `throw` node,
 *   so the drawing has no `switch` in it either — the statement is sugar
 *   over the same conditional a chain of guards is.
 * - **Hex escape** and **Parse error** do not parse, because an error is
 *   something this demo shows too.
 *
 * The state is the text itself, not the graph: the graph is a function of
 * it, and storing a value the state can already compute is how the two
 * drift apart. Picking an example replaces the text with its source.
 *
 * The picker is built once, as the module loads, which is where a list
 * with a repeated name or source is refused.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = stageDemo({
    intro: 'Lowers a FunctionalScript module to an expression graph. Arrows point to operands, multiple arrows to one node show sharing, and dashed arrows mark operands that may not be evaluated.',
    name: 'edag',
})(text => {
    const [kind, value] = graphOfText(text)
    return [kind === 'ok' ? graphSvg(value) : refusal(value)]
})
