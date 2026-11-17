/**
 * A FunctionalScript expression as the graph its compiler builds: type
 * `export default <expr>;`, see the EDAG — Expression DAG — [`unresolved`
 * lowers](./module.f.js) it to, drawn with [the shared graph
 * module](../../website/demo/graph/module.f.js).
 *
 * **A module with named exports draws as the object of its exports.** Only
 * a module whose one export is its default draws as that value: reading
 * `.default` off any other would draw a value the source never wrote —
 * `undefined` for `export const a = []`.
 *
 * **A `const` referenced twice is one node with two incoming edges, not
 * two nodes that happen to match.** Every reference to the same `const`
 * lowers to the same `Exp` object — [`unresolved`'s own
 * doc](./module.f.js) says so — so `1+2` written once and used three times
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
 * **The operators are drawn by [the shape the EDAG shares with FAST and
 * the source AST](../graph/module.f.js)**, whose doc says how:
 * a property read draws its key as a value, a method call or an optional
 * chain is one node, a table of its links, and a tag no shape describes is
 * drawn as itself rather than silently dropped. This module adds the
 * EDAG's own forms. A function is a `=>` node with its length in its
 * `length` port.
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
 * **Recursion is an arrow back to the function.** `self` is the innermost
 * function whose body holds it, so it draws as a back edge to the nearest
 * `=>` the walk entered through its `body` port, routed within its cyclic
 * group. Returns to one function share their trunk and arrowhead. A `self` in a slot a nested function captures belongs to the
 * enclosing function, and the `=>` it is entered through is skipped
 * because its port is that slot, not `body`.
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
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 */

import { graphSvg } from '../../website/demo/graph/module.f.js'
import { refusal } from '../../website/demo/module.f.js'
import { stageDemo } from '../stage_demo/module.f.js'
import { graphOfText } from './graph/module.f.js'

/**
 * The drop-down is [the compiler's shared list](../examples/module.f.mjs), one
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
 * - **Recursion** draws the recursive call's `callee` as an arrow back to
 *   the `=>`, routed within its cyclic group.
 *   **Recursion: Ackermann** has three such connections. Their source
 *   branches join a shared return trunk and one arrowhead. Hovering the
 *   shared trunk traces all three calls; each source port traces its own.
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
 *   its broken `idx` edge, and `.` beside `key` — and `(o?.a.f)(...[i, 2])`
 *   ends with a `(?.)()` link whose arguments, a `[]` node with its spread,
 *   run regardless and draw solid. The `3` beside them is a value in the
 *   array, so the array's rows name the two chains they reach, by their
 *   spellings `?.a.f()[].length` and `(?.a.f)()`.
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
    intro: 'Lowers a FunctionalScript module to an expression graph. Arrows point to operands, multiple arrows to one node show sharing, and dashed arrows mark operands that may not be evaluated. Hover an operand name or reference to follow its arrow; hover a node title to see its incoming uses. Click an arrow to keep it selected, or use Tab to move between connections.',
    name: 'edag',
})(text => {
    const [kind, value] = graphOfText(text)
    return [kind === 'ok' ? graphSvg({ ...value, trace: true }) : refusal(value)]
})
