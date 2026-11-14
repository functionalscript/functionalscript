/**
 * What the [owned-stage check](./module.f.js) carries through a function.
 *
 * @module
 */

import type { OrderedMap } from '../../../types/ordered_map/types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { Interface, Signature, Type, Typed } from '../../types.ts'

/**
 * A value as the check sees it: of a type that holds no sealed value; owned,
 * so that whoever takes it consumes it; or borrowed, leaning on the owned
 * locals that must outlive it. A borrow of a parameter that borrows leans on
 * none, since the parameter outlives the body.
 */
export type _Value = readonly ['plain'] | readonly ['owned'] | readonly ['borrowed', roots: readonly string[]]

/** A local: one that the function owns, a borrow that leans on owned locals, or one of a type that holds no sealed value. */
export type _Local = readonly ['own'] | readonly ['borrow', roots: readonly string[]] | readonly ['plain']

/** How a term's context takes its value: it may take an owned local's value over, or it only borrows the value. */
export type _Mode = 'take' | 'read'

/**
 * What a label names: the function's `return`; a block, with the owned
 * locals alive where its region begins and how its context takes its value;
 * or a loop, with the owned locals alive where it begins and its parameters
 * as locals.
 */
export type _Label =
    | readonly ['return']
    | readonly ['block', start: readonly string[], mode: _Mode]
    | readonly ['loop', start: readonly string[], params: readonly (readonly [name: string, local: _Local])[]]

/** A `br` that leaves a block: the block's label, the owned locals alive as it leaves, and its value. */
export type _Exit = readonly [label: string, owned: readonly string[], value: _Value]

/**
 * What a term does: the owned locals alive after it, `null` where it never
 * completes; its value; and the exits it takes to the blocks around it.
 */
export type _Out = {
    readonly next: readonly string[] | null
    readonly value: _Value
    readonly exits: readonly _Exit[]
}

/** Terms walked in their order: the owned locals alive after the last, `null` where one never completes; their values; and their exits. */
export type _Seq = {
    readonly owned: readonly string[] | null
    readonly results: readonly _Value[]
    readonly exits: readonly _Exit[]
}

/** Where a term stands: its function's name and result, the module's signatures, the interfaces, and the locals and labels in scope. */
export type _Env = {
    readonly name: string
    readonly result: Type
    readonly functions: OrderedMap<Signature>
    readonly imports: OrderedMap<Interface>
    readonly locals: OrderedMap<_Local>
    readonly labels: OrderedMap<_Label>
}

/** Walk one term from the owned locals alive before it, as its context takes its value. */
export type _Walk = (env: _Env, owned: readonly string[], t: Typed, mode: _Mode) => Result<_Out, string>
