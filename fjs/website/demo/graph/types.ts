/**
 * Type-level API for `fjs/website/demo/graph/module.f.mjs`: a node-and-edge
 * diagram any demo can hand a walked value to, once it has turned that value
 * into nodes and edges of its own.
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
 */
export type Inline = { readonly inline: string }

/** A graph `graphSvg` (`./module.f.mjs`) can draw: every node ranked, every edge named. */
export type Graph = {
    readonly nodes: readonly Ranked[]
    readonly edges: readonly Edge[]
}
