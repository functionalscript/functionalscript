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
 * An empty `label` draws no title row on a node with edges, for a demo
 * whose rows already say what the node is.
 */
export type Node = {
    readonly id: number
    readonly kind: string
    readonly label: string
}

/** A {@link Node} once `ranked` (`./module.f.mjs`) has placed it. */
export type Ranked = Node & { readonly rank: number }

/**
 * One edge, from a node's id to another's, labeled with the index or key
 * that reaches it. The label is drawn in a port of the source node — a
 * row of its own under the node's label, which the edge leaves from — and
 * a node's ports follow the order its edges are given in.
 *
 * `kind` is the demo's own vocabulary, as a {@link Node}'s is, and is
 * absent where a demo draws one kind of edge. `"lazy"` draws dashed by the
 * site's stylesheet; any other value, and none, draws solid.
 *
 * **An edge ends at a node, or at an {@link Inline} value** drawn in its
 * port, right of the label, rather than as a node of its own.
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
}

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
 */
export type Inline = {
    readonly inline: string
    readonly kind?: string | undefined
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
