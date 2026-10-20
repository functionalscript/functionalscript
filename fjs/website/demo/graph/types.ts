/**
 * Type-level API for `fjs/website/demo/graph/module.f.mjs`: a node-and-edge
 * diagram any demo can hand a value to, once it can say what {@link Shape}
 * each of its values has.
 *
 * @module
 */

/**
 * A node before its rank is known: everything a demo's own walk can decide
 * about a value without knowing where anything else in the graph sits.
 *
 * `kind` is the demo's own vocabulary, not this module's — `"leaf"` draws
 * dashed by the site's stylesheet, and any other value draws as a plain
 * solid box, so a demo with more than one kind of container is one CSS rule
 * away from telling them apart too.
 *
 * A node with edges draws its `label` as a column left of its rows. An
 * empty `label` draws no column, for a demo whose rows already say what
 * the node is.
 *
 * `order`, when given, is the node's place in an animation, drawn as
 * `data-graph-order`: the site's stylesheet fades a `new` node in and a
 * `leaving` one out, a second after the order before it, so a change can
 * appear node by node.
 *
 * `key`, when given, names the node across drawings: its box and its text
 * are each drawn in a group moved into place by a `transform` and keyed
 * `data-key`, so a page that patches the drawing keeps the same groups for
 * the same node, and the site's stylesheet slides them from where they
 * were to where they are.
 */
export type Node = {
    readonly id: number
    readonly kind: string
    readonly label: string
    readonly order?: number | undefined
    readonly key?: string | undefined
}

/** A {@link Node} once `ranked` (`./module.f.mjs`) has placed it. */
export type Ranked = Node & { readonly rank: number }

/**
 * One edge, from a node's id to another's, labeled with the index or key
 * that reaches it. The label is drawn in a port of the source node — a
 * row of its own right of the node's label, which the edge leaves from —
 * and a node's ports follow the order its edges are given in.
 *
 * `kind` is the demo's own vocabulary, as a {@link Node}'s is, and is
 * absent where a demo draws one kind of edge. `"lazy"` draws dashed by the
 * site's stylesheet; any other value, and none, draws solid.
 *
 * **An edge ends at a node, or at an {@link Inline} value** drawn in its
 * port, right of the label, rather than as a node of its own.
 *
 * **Beside values, an edge's row shows the label of the node it leads
 * to** in the value's place, its key in the key column, marked
 * `data-graph-value-ref` so the stylesheet draws it as part of the edge.
 * So does a row with an empty label beside other edges. In a node whose
 * rows are all edges with empty labels, no row is drawn at all.
 *
 * **An edge's kind is about the edge, not about what it points at.** The
 * EDAG demo marks an operand a node may never evaluate — `&&`'s right, an
 * arm of `?:` — and the same node reached from an eager position elsewhere
 * is still evaluated there, so the distinction cannot live on the node.
 */
export type Edge = {
    readonly from: number
    readonly to: number | Inline
    readonly label: string
    readonly kind?: string | undefined
    readonly corner?: Corner | undefined
}

/**
 * Where an {@link Edge} with no row of its own leaves its node: the top or
 * the bottom corner of its right side, or the middle of it. For a node
 * whose children are ordered and need no names — a tree's left and right,
 * and a B-tree's middle — the corner says which child it is. Such an edge
 * ends at a node, not a value, and has no label. A node whose arrows leave
 * from its corners has rows for values only: an arrow from a row beside
 * them is refused, since a `middle` corner starts where the middle of an
 * odd number of rows does.
 */
export type Corner = 'top' | 'middle' | 'bottom'

/**
 * A value too simple to be a node of its own — a number, `null`,
 * `undefined` — drawn inside its source's port, right of the edge's label.
 * An inline value has no identity, so it is never shared, never ranked and
 * no line is drawn to it: a demo that wants a value shared, or reached by
 * more than one edge, gives it a node instead.
 *
 * `kind` is the demo's own vocabulary, as a {@link Node}'s is, and is
 * absent for an ordinary value. The site's stylesheet draws a
 * `"terminal"` value — an input a scope receives, rather than a constant —
 * filled like a terminal node, where any other value, and none, is tinted.
 *
 * `parts`, when given, draws the value in pieces, each marked with its own
 * kind as `data-graph-part`, so a stylesheet can colour them apart — the
 * bits a prefix inherits beside the bits it adds, say. Joined, they must
 * spell `inline`, which is still what sizes the cell.
 *
 * `click`, when given, makes the value's cell a control: a click on it, or
 * Enter or Space while it has focus, sends the demo a `click` event with
 * `click.name`, and `click.label` is what a screen reader announces.
 */
export type Inline = {
    readonly inline: string
    readonly kind?: string | undefined
    readonly parts?: readonly (readonly [text: string, kind: string])[] | undefined
    readonly click?: Click | undefined
}

/** A control's demo event name and what it says it does. */
export type Click = {
    readonly name: string
    readonly label: string
}

/**
 * An arrow into a node from nowhere: where a reader enters the graph, such
 * as a version's root. It has no label. `kind` is the demo's own
 * vocabulary, drawn as `data-graph-edge-kind` like an {@link Edge}'s.
 */
export type Entry = {
    readonly to: number
    readonly kind?: string | undefined
}

/**
 * A graph `graphSvg` (`./module.f.mjs`) can draw: every node ranked, every
 * edge named, and the {@link Entry} arrows into it, if it has any.
 *
 * `edgeOrder` is the order, and `new` the kind, an edge or entry takes when
 * neither of its nodes has an order of its own — so that, while keyed nodes
 * slide, the edges between them, whose routes cannot slide, wait hidden
 * and fade in once the nodes have arrived. Without it such an edge does
 * not fade.
 */
export type Graph = {
    readonly nodes: readonly Ranked[]
    readonly edges: readonly Edge[]
    readonly entries?: readonly Entry[] | undefined
    readonly edgeOrder?: number | undefined
}

/**
 * How `graphOf` (`./module.f.mjs`) reads one value: a node, with the
 * values its edges lead to, or a spelling drawn inline in its parent's port.
 *
 * A node shape's `kind` and `label` become its {@link Node}'s, and each
 * child's label and optional kind become an {@link Edge}'s. The inline
 * shape is an {@link Inline} as it stands.
 */
export type Shape<V> =
    | {
        readonly kind: string
        readonly label: string
        readonly children: readonly (readonly [label: string, value: V, kind?: string])[]
    }
    | Inline
