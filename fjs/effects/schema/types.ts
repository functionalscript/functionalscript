/**
 * The declarations in [`../node/types.ts`](../node/types.ts), pinned to the
 * schemas of [`./module.f.mjs`](./module.f.mjs): an operation derived from its
 * schema is exactly the operation declared by hand.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Check, CheckRaw, Ts } from '../../rtti/ts/types.ts'
import type { Type } from '../../rtti/types.ts'
import type { Vec } from '../../types/bit_vec/types.ts'
import type { Mkdir, ReadFile, Readdir, ResolveFileModule, Rm, Write, WriteBytes, WriteFile } from '../node/types.ts'
import type { Read } from '../common/types.ts'
import type { Operation, Param, Return } from '../types.ts'
import type * as S from './module.f.mjs'

// Rebuilding the call signature drops the Phantom field, forcing a structural
// check of the runtime schema. CheckRaw also pins that its root excludes absence.
// The raw and annotated types intentionally differ: bigint / Vec, undefined / void.
type _VecSchema = Assert<CheckRaw<bigint, () => ReturnType<typeof S.vec>>>
type _NothingSchema = Assert<CheckRaw<undefined, () => ReturnType<typeof S.nothing>>>
type _Vec = Assert<Check<Vec, typeof S.vec>>
type _Nothing = Assert<Check<void, typeof S.nothing>>

/** An operation as its schema derives it: the tag and a function of the parameters. */
export type Derived<O extends { readonly name: string, readonly params: readonly Type[], readonly answer: Type }> =
    Ts<O['params']> extends infer P extends readonly unknown[]
        ? readonly [O['name'], (...params: P) => Ts<O['answer']>]
        : never

/** Compare parameters as data: function assignability permits dropping optional arguments. */
type _Signature<O extends Operation> = readonly [O[0], Readonly<Param<O>>, Return<O>]

/**
 * Mutual assignability, where `Equal` would be too strict: a struct with an
 * optional member derives as an intersection of its required and optional
 * fields, which `Equal` tells from the one object type declared by hand
 * though neither admits a value the other does not.
 *
 * Parameter tuples retain the distinction between absence and a present
 * `undefined` under `exactOptionalPropertyTypes`: removing `undefined` from
 * `mkdir.params` fails here as well as in the runtime proof.
 */
type _Same<A extends Operation, B extends Operation> =
    readonly [_Signature<A>] extends readonly [_Signature<B>]
        ? readonly [_Signature<B>] extends readonly [_Signature<A>] ? true : false
        : false

type _Mkdir = Assert<_Same<Derived<typeof S.mkdir>, Mkdir>>
type _ReadFile = Assert<_Same<Derived<typeof S.readFile>, ReadFile>>
type _ResolveFileModule = Assert<_Same<Derived<typeof S.resolveFileModule>, ResolveFileModule>>
type _Readdir = Assert<_Same<Derived<typeof S.readdir>, Readdir>>
type _WriteFile = Assert<_Same<Derived<typeof S.writeFile>, WriteFile>>
type _WriteBytes = Assert<_Same<Derived<typeof S.writeBytes>, WriteBytes>>
type _Rm = Assert<_Same<Derived<typeof S.rm>, Rm>>
type _Write = Assert<_Same<Derived<typeof S.write>, Write>>
type _Read = Assert<_Same<Derived<typeof S.read>, Read>>
