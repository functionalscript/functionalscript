/**
 * Type-level API for the layer every BNF matcher backend shares: the position
 * it matches at, the AST it builds, and the result that pairs them.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { StateFold } from '../../types/function/operator/types.ts'
import type { CodePoint } from '../../text/utf16/types.ts'
import type { Rule } from '../types.ts'

/** A value paired with metadata. */
export type Meta<M, T> = readonly[value: T, metadata: M]

/** A variant branch paired with the value produced by that branch. */
export type Branch<T> = {
    readonly[K in keyof T]: K extends string | number
        ? readonly[`${K}`, T[K]]
        : never
}[keyof T]

/** Output produced by a rule transformer. */
export type Out<M, T> = Meta<M, T>

export type TerminalTransformer<M, T> =
    (value: Meta<M, CodePoint>) => Out<M, T>

export type SequenceTransformer<M, C extends readonly unknown[], T> =
    (value: Meta<M, C>) => Out<M, T>

export type VariantTransformer<M, C extends object, T> =
    (value: Meta<M, Branch<C>>) => Out<M, T>

export type RepeatTransformer<M, C, S, T> =
    StateFold<Meta<M, C>, S, Out<M, T>>

export type Transformer<M, T> =
    | readonly['terminal', TerminalTransformer<M, T>]
    | readonly['sequence', number, SequenceTransformer<M, never, T>]
    | readonly['variant', readonly string[], VariantTransformer<M, never, T>]
    | readonly['repeat', Rule, RepeatTransformer<M, never, unknown, T>]
    | readonly['unit']

/** A transformer tied to the metadata factory that created it. */
export type Entry<M, T> = {
    readonly factory: symbol
    readonly rule: Rule
    readonly transformer: Transformer<M, T>
}

/** A checked collection of entries from one metadata factory. */
export type TransformerMap<M> = {
    readonly factory: symbol
    readonly entries: ReadonlyMap<Rule, Transformer<M, unknown>>
}

/** Constructors shared by backend-specific transformer factories. */
export type TransformerTools<M> = {
    readonly entry: <T>(rule: Rule, transformer: Transformer<M, T>) => Entry<M, T>
    readonly map: (...entries: readonly Entry<M, unknown>[]) => TransformerMap<M>
    readonly terminalOf: <T>(f: TerminalTransformer<M, T>) => Transformer<M, T>
    readonly sequenceOf: <C extends readonly unknown[], T>(
        arity: C['length'],
        f: SequenceTransformer<M, C, T>,
    ) => Transformer<M, T>
    readonly variantOf: <C extends object, T>(
        branches: readonly (keyof C & string)[],
        f: VariantTransformer<M, C, T>,
    ) => Transformer<M, T>
    readonly repeatOf: <C, S, T>(
        item: Rule,
        fold: RepeatTransformer<M, C, S, T>,
    ) => Transformer<M, T>
    readonly unit: Transformer<M, undefined>
}

/** State used by the default AST repetition transformer. */
export type _AstRepeatState<M> = readonly[items: List<unknown>, metadata: M]

/**
 * Tag of an AST node: the variant branch that matched, `true` where a rule
 * matched empty input without naming a branch, and `undefined` where the rule
 * is not a choice at all.
 */
export type AstTag = string | true | undefined

/**
 * An AST over leaves of type `L`. Parser backends use metadata-bearing code
 * points; the generic remains useful to the shared constructors.
 */
export type Ast<L> = {
    readonly tag: AstTag
    readonly sequence: AstSequence<L>
}

/** The children of an {@link Ast} node: nested nodes and consumed leaves. */
export type AstSequence<L> = readonly(Ast<L> | L)[]

/**
 * A match position over input of `length` leaves: `0 .. length` are the
 * physical positions, and `length + 1` is where the one synthesized
 * end-of-input symbol has been consumed.
 *
 * This is the complete cursor `(idx, eofConsumed)` of
 * [the BNF contract](../README.md#logical-eof-in-parser-input) written as one
 * number. `eofConsumed` can only be true at the physical end, so the pair and
 * the extended position hold the same information — and being one number is
 * what makes every ordering a backend needs a plain `<`, because consuming EOF
 * *is* progress even though the public index does not move. A backend that
 * treated it as no progress would loop forever on a repetition over a rule that
 * can match EOF.
 *
 * Public positions are physical, so a cursor is converted back with
 * `physicalIdx` before it leaves a backend.
 */
export type Cursor = number

/**
 * A matcher's own result: the AST built so far, whether it matched, and where
 * it stopped.
 *
 * `P` is the position type. A backend whose match always has one uses
 * {@link Cursor}; one that also reports running out of input uses
 * `Cursor | null`. Public results are each backend's own type — this is the
 * shape they are built from, not the shape they return.
 */
export type AstResult<L, P> = {
    readonly ast: Ast<L>
    readonly success: boolean
    readonly pos: P
}
