/**
 * Implementation-private types for the graph demo, `./demo.f.mjs`.
 *
 * @module
 */

/**
 * A node as the walk discovers it — everything but its rank, which is not
 * yet known: a later edge from elsewhere in the document may still demand a
 * longer route to it than the one that created it.
 */
export type _Bare = {
    readonly id: number
    readonly kind: 'array' | 'object' | 'leaf'
    readonly label: string
}

/** A {@link _Bare} node once its rank — the longest path from the root — is known. */
export type _Node = _Bare & { readonly rank: number }

export type _Edge = { readonly from: number, readonly to: number, readonly label: string }

export type _State = {
    readonly refs: readonly (readonly [object, number])[]
    readonly nodes: readonly _Bare[]
    readonly edges: readonly _Edge[]
    readonly next: number
}

export type _Positioned = _Node & {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

export type _Graph =
    | { readonly ok: true, readonly nodes: readonly _Node[], readonly edges: readonly _Edge[] }
    | { readonly ok: false, readonly error: string }
