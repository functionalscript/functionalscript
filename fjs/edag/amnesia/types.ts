import type { Exp } from '../types.ts'

export type ExpOp = Extract<Exp, readonly unknown[]>

export type Context = {
    readonly frame: unknown,
    readonly args: readonly unknown[],
    /**
     * Nodes whose values the caller already established, consulted by node
     * identity before anything is computed — `../execution-models.md`'s
     * §2.2, "memoize only shared nodes", in the form where the caller did the
     * analysis. Absent is the model this evaluator is named for: nothing
     * remembered, every incoming edge walked again.
     *
     * A caller that supplies one owes the order: an entry may only be built
     * from entries before it, since this is consulted and never extended.
     */
    readonly memo?: readonly (readonly [Exp, unknown])[],
}

type Get0<T extends ExpOp, K extends ExpOp[0]> =
    T extends readonly [infer Op, ...readonly unknown[]]
        ? K extends Op
            ? T
            : never
        : never

// The tag -> node-tuple correlation as one mapped type, so a dispatcher
// generic over `K` sees `Map[K]` as a single signature `(c, r: TagMap[K])`
// rather than a union of all handler signatures — the correlated-union
// workaround (microsoft/TypeScript#47109). Indexing `Map` with a
// non-generic union key still yields the uncallable union, so dispatch
// must go through such a `K`.
export type TagMap = { readonly[K in ExpOp[0]]: Get0<ExpOp, K> }

export type Map = {
    readonly[K in ExpOp[0]]: (c: Context, r: TagMap[K]) => unknown
}

export type Get<K extends ExpOp[0]> = TagMap[K]
