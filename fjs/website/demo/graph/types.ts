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
 * `leaving` one out, 150 ms after the order before it, so a change can
 * appear node by node.
 *
 * `key`, when given, names the node across drawings: its box and its text
 * are each drawn in a group moved into place by a `transform` and keyed
 * `data-key`, so a page that patches the drawing keeps the same groups for
 * the same node, and the site's stylesheet slides them from where they
 * were to where they are. An edge or entry between keyed nodes is keyed by
 * their keys too, so its route slides with them where the browser animates
 * a path's `d`, and is redrawn at once where it does not.
 *
 * **A node with `groups` draws its label column in pieces**, a cell per
 * {@link Group}, each beside its own rows, in place of `label`: a record
 * whose rows fall into parts, such as a chain's links, names each part
 * where it is. `label` is still what a row of another node names it by.
 */
export type Node = {
    readonly id: number
    readonly kind: string
    readonly label: string
    readonly order?: number | undefined
    readonly key?: string | undefined
    readonly groups?: readonly Group[] | undefined
}

/**
 * One cell of a node's label column: its `label`, beside the next `rows`
 * of the node's rows. A node's groups take its rows in order and must
 * take every one of them, at least one each.
 */
export type Group = readonly [label: string, rows: number]

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
 *
 * **A `back` edge closes a cycle**, such as a recursive call to the
 * function whose body holds it. It ends at a node, and ranking ignores it,
 * so it can point to its source's own rank or any rank left of it. It is drawn
 * around the outside of the graph: down from its port to below every node,
 * left along the bottom, and up into its target's left side, in a lane of
 * its own below the graph and in each gap it goes down or up. With
 * `Graph.bundleBacks`, edges of the same kind returning to the same node
 * share those lanes and one destination arrowhead.
 */
export type Edge = {
    readonly from: number
    readonly to: number | Inline
    readonly label: string
    readonly kind?: string | undefined
    readonly corner?: Corner | undefined
    readonly back?: boolean | undefined
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
 */
export type Graph = {
    readonly nodes: readonly Ranked[]
    readonly edges: readonly Edge[]
    readonly entries?: readonly Entry[] | undefined
    /** Share return lanes and an arrowhead for back edges to the same node of the same kind. */
    readonly bundleBacks?: boolean | undefined
    /** Trace lines/output ports, incoming connections at node names, or native keyboard/click focus. */
    readonly trace?: boolean | undefined
    /**
     * Center non-tree nodes on incoming forward connections, fitting nodes
     * and routing lanes within the tallest packed column without overlaps.
     * Trees retain their parent/child centering.
     */
    readonly centerColumns?: boolean | undefined
}

/**
 * How `graphOf` (`./module.f.mjs`) reads one value: a node, with the
 * values its edges lead to, a spelling drawn inline in its parent's port,
 * or a {@link Back} reference to a node the walk is inside.
 *
 * A node shape's `kind`, `label` and `groups` become its {@link Node}'s,
 * and each child's label and optional kind become an {@link Edge}'s. The
 * inline shape is an {@link Inline} as it stands.
 */
export type Shape<V> = NodeShape<V> | Inline | Back<V>

/** A {@link Shape} that is a node, with the values its edges lead to. */
export type NodeShape<V> = {
    readonly kind: string
    readonly label: string
    readonly children: readonly (readonly [label: string, value: V, kind?: string])[]
    readonly groups?: readonly Group[] | undefined
    /** A use of this node from inside itself draws as a back edge. */
    readonly recursive?: boolean | undefined
}

/**
 * A value that stands for a node the walk is inside, such as an EDAG's
 * `self` for the function whose body holds it: drawn as a `back`
 * {@link Edge} to the nearest such node for which `owner` holds. `port` is
 * the label of the edge the walk left that node by, so that a function's
 * body can be told from a slot its parent fills.
 */
export type Back<V> = {
    readonly owner: (value: V, port: string) => boolean
}
