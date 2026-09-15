import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Array as ExpArray, Call, Dot, Exp, Op1, Op12, Op2, Op3 } from '../types.ts'

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

// The tag -> node-tuple correlation `TagMap` is built on, pinned tag by tag,
// including the tags whose node kinds are not `op1`/`op2`.
//
// These were `proof.f.mjs`'s `tagMap` entry, a body of nothing but typedefs,
// so none of them bound to a statement and all eight were green whatever they
// claimed (`../../AGENTS.md` §1.4). At module scope in a `.ts` file an alias
// is resolved on sight, so each one below was falsified once and seen to fail
// before being restored.

type _MulIsOp2 = Assert<Equal<Get<'*'>, Op2>>
type _NotIsOp1 = Assert<Equal<Get<'!'>, Op1>>
type _PlusIsOp12 = Assert<Equal<Get<'+'>, Op12>>
type _MinusIsOp12 = Assert<Equal<Get<'-'>, Op12>>
type _ConditionalIsOp3 = Assert<Equal<Get<'?:'>, Op3>>
type _BracketsIsArray = Assert<Equal<Get<'[]'>, ExpArray>>
type _CallIsCall = Assert<Equal<Get<'()'>, Call>>
type _DotIsDot = Assert<Equal<Get<'.'>, Dot>>
