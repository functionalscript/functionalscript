/**
 * Implementation-private types for the graph demo, `./demo.f.mjs`. The node
 * and edge shapes themselves are `fjs/website/demo/graph`'s — this file adds
 * only what is specific to walking a DataJS value.
 *
 * @module
 */

import type { Edge, Node, Ranked } from '../../website/demo/graph/types.ts'

export type _State = {
    readonly refs: readonly (readonly [object, number])[]
    readonly nodes: readonly Node[]
    readonly edges: readonly Edge[]
    readonly next: number
}

export type _Graph =
    | { readonly ok: true, readonly nodes: readonly Ranked[], readonly edges: readonly Edge[] }
    | { readonly ok: false, readonly error: string }
