/**
 * The declarations in [`../node/types.ts`](../node/types.ts), pinned to the
 * schemas of [`./module.f.mjs`](./module.f.mjs): an operation derived from its
 * schema is exactly the operation declared by hand.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Ts } from '../../rtti/ts/types.ts'
import type { Type } from '../../rtti/types.ts'
import type { Mkdir, ReadFile, Readdir, ResolveFileModule, Rm, Write, WriteBytes, WriteFile } from '../node/types.ts'
import type { Read } from '../common/types.ts'
import type * as S from './module.f.mjs'

/** An operation as its schema derives it: the tag and a function of the parameters. */
export type Derived<O extends { readonly name: string, readonly params: readonly Type[], readonly answer: Type }> =
    Ts<O['params']> extends infer P extends readonly unknown[]
        ? readonly [O['name'], (...params: P) => Ts<O['answer']>]
        : never

/**
 * Mutual assignability, where `Equal` would be too strict: a struct with an
 * optional member derives as an intersection of its required and optional
 * fields, which `Equal` tells from the one object type declared by hand
 * though neither admits a value the other does not.
 */
type Same<A, B> = readonly [A] extends readonly [B] ? readonly [B] extends readonly [A] ? true : false : false

type _Mkdir = Assert<Same<Derived<typeof S.mkdir>, Mkdir>>
type _ReadFile = Assert<Same<Derived<typeof S.readFile>, ReadFile>>
type _ResolveFileModule = Assert<Same<Derived<typeof S.resolveFileModule>, ResolveFileModule>>
type _Readdir = Assert<Same<Derived<typeof S.readdir>, Readdir>>
type _WriteFile = Assert<Same<Derived<typeof S.writeFile>, WriteFile>>
type _WriteBytes = Assert<Same<Derived<typeof S.writeBytes>, WriteBytes>>
type _Rm = Assert<Same<Derived<typeof S.rm>, Rm>>
type _Write = Assert<Same<Derived<typeof S.write>, Write>>
type _Read = Assert<Same<Derived<typeof S.read>, Read>>
