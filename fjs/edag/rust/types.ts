/**
 * Type-level API of the EDAG→Rust printer.
 *
 * @module
 */

import type { Exp } from '../types.ts'
import type { Result } from '../../types/result/types.ts'

/**
 * A `nanvm_lib` name printed text spells: an item of `nanvm_lib::vm` — a
 * type such as `Nullish`, or a trait such as `ToAny` whose method the text
 * calls — or a helper of `nanvm_lib::vm::unstable`. `Any` and the VM bound
 * are not among them: every scope spells both.
 */
export type Use = readonly [module: 'vm' | 'unstable', name: string]

/** A printed value — a piece of text, or a block's lines — with the names it spells. */
export type Printed<T> = readonly [value: T, uses: readonly Use[]]

/** The names a scope spells, each module's sorted and without repeats. */
export type Uses = {
    readonly vm: readonly string[]
    readonly unstable: readonly string[]
}

/** A scope's lines and the names they spell, what {@link Uses} `use` lines import. */
export type Scope = {
    readonly lines: readonly string[]
    readonly uses: Uses
}

/**
 * The printer of one EDAG in [`module.f.mjs`](./module.f.mjs), in one mode
 * over one set of bindings: `f` prints a node's text where it is referenced
 * — a primitive's literal, a bound node's name, any other node's own
 * construction — and `block` prints the lines of a node's block, a `let`
 * per temporary the node binds and the node as the `Result` the block
 * answers. Both answer the refusal instead where a node has no `nanvm-lib`
 * spelling, and both report the names they spell.
 */
export type Printer = {
    readonly f: (e: Exp) => Result<Printed<string>, readonly unknown[]>
    readonly block: (e: Exp) => Result<Printed<readonly string[]>, readonly unknown[]>
}
