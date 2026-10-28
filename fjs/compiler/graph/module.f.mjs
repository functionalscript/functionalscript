/**
 * The operators the EDAG, FAST and the source AST share, as
 * [`graphOf`](../../website/demo/graph/module.f.mjs) shapes: one drawing
 * of them for every graph of the compiler's trees. The three spell an
 * operator with the same tuple — `fjs/js/ast/types.ts`'s `Operator<V>` —
 * except for the array and object tags, which a caller names in
 * {@link Tags}. Every form the vocabulary does not share is the caller's,
 * through the shape it passes for them.
 *
 * **It serves the compiler's stage pages**, as
 * [`stage_demo`](../stage_demo/module.f.mjs) does, and lives beside it: it
 * draws with the website's renderer, which `fjs/js/ast` and `fjs/edag`,
 * below the compiler, do not depend on.
 *
 * **A property read draws its key as a value.** `a.x` is a `.` node with
 * the receiver in its `obj` port and the key in its `key` port, `"x"`;
 * `a[5]` is the same `.` with the index in its `idx` port, `5`. A computed
 * index, `a[Number(i)]`, is an edge from `idx` to the node it is.
 *
 * **A method call is one node.** `o.f(x)` is a `.` carrying its call as a
 * continuation, `['.', o, 'f', ['|()', [x]]]`, not a `()` over a `.`: the
 * receiver stays live into the call rather than becoming a value of its
 * own, and a drawing with two nodes would show a value the tree never has.
 * So it draws as one node, **a table of its links**: a cell per link
 * holding its operator, beside that link's rows, each row a role and its
 * value or arrow, as every node's are. The `.` link has two, the receiver
 * in `obj` and the key `"f"` in `key`, as a plain `o.f` draws, and the `()`
 * link one, its arguments in `...`, an arrow to the array node they are
 * drawn as. A call's arguments are one node, as an array literal's items
 * are, rather than a port each: two calls in one chain would otherwise
 * both have a `0`. A plain call, `f(x)`, is the same one link, `callee` and
 * `...`. The node's label still spells the chain, `.f()`, and is what a
 * row of another node names it by.
 *
 * **An optional chain is one node too, and its region is on the edges.**
 * `a?.b.c?.(x)` is one `?.` node carrying its steps as its continuation —
 * `fjs/edag/README.md`, Chains — so it draws as one table: `?.` beside
 * `obj` and `key`, `.` beside `key`, `?.()` beside `...`. The first link
 * always takes two rows, receiver and key, as a plain `a.b` does; a guarded
 * call, `f?.(x)`, starts with `?.()` beside `callee` and `...`. A numbered
 * key is a value in its link's `idx` row and a computed one an arrow from
 * it. Everything after a `?.` is skipped when the value before it is
 * nullish, so those edges are broken: a guarded call's arguments and every
 * step's after it, and a guarded access's computed key. The receiver, a
 * plain method call's arguments and the arguments of a call whose
 * parentheses ended the region, `(a?.b)(x)`, run regardless and draw
 * solid; that call's link is `(?.)()`, since the parentheses are the one
 * thing that tells it from `a?.b(x)`.
 *
 * **An operand a node may never evaluate draws dashed**: both arms of `?:`,
 * which establishes its condition and then exactly one arm, and the chain
 * operands above. The mark is on the **edge** and not on the node it
 * reaches, because laziness is positional: a node reached from an eager
 * position elsewhere is evaluated there whatever reaches it here, and a
 * node is drawn once however many edges arrive.
 *
 * **A primitive draws inside the node that uses it**, a value in its
 * user's port beside the operand's role, and so does a leaf operator —
 * `entry`, `hasEntry`, an intrinsic or a static function — marked as the
 * terminal it is. Only a tree that is one of these and nothing else draws
 * one as a node, having no user to sit in.
 *
 * Reads a value by its runtime shape rather than its static type, so a
 * proof can hand it a tag no tree produces yet.
 *
 * @module
 *
 * @import { Primitive } from '../../media/datajs/types.ts'
 * @import { Shape } from '../../website/demo/graph/types.ts'
 * @import { Tags } from './types.ts'
 * @import { _Chain, _Child } from './private.ts'
 */

import { intrinsicIds, staticIds } from '../../edag/module.f.mjs'
import { leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { chunksText } from '../../text/marked/module.f.mjs'

// The operator tag groups `fjs/js/ast/types.ts` names, read here rather
// than reconstructed from the compiler's own runtime schemas: a drawing is
// allowed the loss of automatic drift-detection a schema import would buy,
// for a flat list of strings simple enough to check against the type file
// by eye. The static functions are the one group a later row grows, so
// they are the EDAG's own list.
const leaves = new Set(['entry', 'hasEntry', ...intrinsicIds, ...staticIds])
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
 * A node no shape describes, drawn as itself, labelled by its tag, rather
 * than silently dropped or wrongly drawn.
 *
 * @type {(exp: readonly unknown[]) => Shape<unknown>}
 */
export const unsupported = exp => ({ kind: 'unsupported', label: `${exp[0]} (not yet drawn)`, children: [] })

/** An edge, marked where its position is lazy. @type {(label: string, value: unknown, lazy: boolean) => _Child} */
const edge = (label, value, lazy) => lazy ? [label, value, 'lazy'] : [label, value]

/**
 * The ports of an array node's items: one per item, named by its position,
 * a spread's marked `...`.
 *
 * @type {(items: unknown) => readonly _Child[]}
 */
const numbered = items => /** @type {readonly unknown[]} */ (items).map((item, i) =>
    item instanceof Array && item[0] === '...' ? [`...${i}`, item[1]] : [`${i}`, item])

/**
 * The operator shape of one vocabulary, with `other` for every tuple it
 * does not share.
 *
 * @type {(tags: Tags) => (other: (exp: readonly unknown[]) => Shape<unknown>) => (e: unknown) => Shape<unknown>}
 */
export const operatorShape = ({ array, object }) => other => {
    /**
     * A call's arguments as the one array node they are drawn as, in a
     * `...` row: a port per argument would give two calls in one chain the
     * same `0`, and a spread is the array's own.
     *
     * @type {(items: unknown, lazy: boolean) => _Child}
     */
    const argsRow = (items, lazy) => edge('...', [array, items], lazy)

    /**
     * A link's key as its row, as a plain `.` node draws it: a name a
     * value in its `key` row, and an index, literal or computed, in its
     * `idx` row — a computed one an edge, lazy inside a region.
     *
     * @type {(index: unknown, lazy: boolean) => _Child}
     */
    const keyRow = (index, lazy) =>
        edge(typeof index === 'string' ? 'key' : 'idx', index, lazy && index instanceof Array)

    /**
     * A chain's steps, each a link of its own in the node its first link
     * began: one row, beside a cell holding the link's operator — `.` with
     * its key, `()` or `?.()` with its arguments, and `(?.)()` for a call
     * whose parentheses closed the region. The node's label spells the
     * chain for the rows that name it, `?.b.c()`.
     *
     * Once a `?.` has been passed, every operand after it is one a nullish
     * value skips and draws lazy — a guarded call's own arguments included
     * — until a closing call's parentheses end the region: its arguments
     * run regardless.
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
     * links, {@link steps}. The first link takes two rows, so that every
     * arrow has its name beside it: an access's receiver in `obj` and its
     * key, or a guarded call's callee in `callee` and its arguments.
     *
     * @type {(exp: readonly unknown[]) => Shape<unknown>}
     */
    const chain = exp => {
        const [tag, base, x, step] = exp
        if (tag === '?.()') {
            return steps({
                label: '?.()',
                children: [['callee', base], argsRow(x, true)],
                groups: [['?.()', 2]],
                lazy: true,
            })(step)
        }
        const guarded = tag === '?.'
        // A plain access with nothing after it is a `.` node of its own, its
        // key a value in its `key` row or its index in its `idx`.
        if (!guarded && step === undefined) {
            return { kind: 'op', label: '.', children: [['obj', base], keyRow(x, false)] }
        }
        return steps({
            label: guarded ? `?.${keyLabel(x)}` : dotLabel(x),
            children: [['obj', base], keyRow(x, guarded)],
            groups: [[guarded ? '?.' : '.', 2]],
            lazy: guarded,
        })(step)
    }

    return e => {
        if (e === null || typeof e !== 'object') { return { inline: chunksText(leafSerialize(/** @type {Primitive} */ (e))) } }
        const exp = /** @type {readonly unknown[]} */ (e)
        const tag = exp[0]
        if (tag === array) { return { kind: 'op', label: '[]', children: numbered(exp[1]) } }
        if (tag === object) {
            const props = /** @type {readonly (readonly unknown[])[]} */ (exp[1])
            return {
                kind: 'op', label: '{}',
                children: props.flatMap((p, i) => p[0] === '...'
                    ? [/** @type {_Child} */ ([`...${i}`, p[1]])]
                    : typeof p[1] === 'string'
                        ? [/** @type {_Child} */ ([p[1], p[2]])]
                        : [/** @type {_Child} */ ([`key${i}`, p[1]]), /** @type {_Child} */ ([`value${i}`, p[2]])]),
            }
        }
        if (tag === '.' || tag === '?.' || tag === '?.()') { return chain(exp) }
        if (tag === '()') { return { kind: 'op', label: '()', children: [['callee', exp[1]], argsRow(exp[2], false)] } }
        if (tag === ',') {
            const items = /** @type {readonly unknown[]} */ (exp[1])
            // **A comma's operands are not alike, and numbering them says
            // they are.** `fjs/edag`'s own doc: it "establishes all of its
            // operands and takes the value of the last one; the earlier
            // operands exist for their throw-potential only — the anchors
            // of computations whose value nothing takes". Five edges
            // labelled `0` to `4` show five equals where one is the answer
            // and four only have to happen.
            //
            // The names carry that and the drawing carries the order, which
            // is what the numbers were really for: the operands sit left to
            // right as they were written.
            const last = items.length - 1
            return { kind: 'op', label: ',', children: items.map((item, i) => [i === last ? 'result' : 'anchor', item]) }
        }
        if (tag === '?:') {
            // The condition is established, then exactly one arm — so both
            // arms are lazy and neither is the operand that always runs.
            return { kind: 'op', label: '?:', children: [['cond', exp[1]], ['then', exp[2], 'lazy'], ['else', exp[3], 'lazy']] }
        }
        if (typeof tag === 'string' && leaves.has(tag)) { return { inline: tag, kind: 'terminal' } }
        if (typeof tag === 'string' && op1.has(tag)) { return { kind: 'op', label: tag, children: [['operand', exp[1]]] } }
        if (typeof tag === 'string' && op2.has(tag)) {
            return { kind: 'op', label: tag, children: [['left', exp[1]], ['right', exp[2]]] }
        }
        // an instance check: its one operand, and the constructor as part
        // of the label, a name the node carries rather than a child
        if (tag === 'instanceof') { return { kind: 'op', label: `instanceof ${exp[2]}`, children: [['operand', exp[1]]] } }
        if (typeof tag === 'string' && op12.has(tag)) {
            return exp.length === 2
                ? { kind: 'op', label: tag, children: [['operand', exp[1]]] }
                : { kind: 'op', label: tag, children: [['left', exp[1]], ['right', exp[2]]] }
        }
        return other(exp)
    }
}
