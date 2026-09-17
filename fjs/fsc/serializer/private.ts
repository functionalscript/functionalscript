/**
 * Implementation-private types of the FunctionalScript writer: what the
 * walk carries, and what a statement is written from.
 *
 * @module
 */

import type { Analysis, Operand } from '../../edag/analysis/types.ts'
import type { List } from '../../types/list/types.ts'

/**
 * A value hoisted into a `const`: an entry of the table by index, or a
 * number or bigint that stands as an access's base, which has no entry
 * because a primitive takes no index.
 */
export type _Hoisted = readonly ['entry', number] | readonly ['leaf', number | bigint]

/**
 * What each statement written so far named: a hoisted value, or nothing
 * where the statement was an anchor's `const`, which holds a value the
 * module does not reach. A name is the slot's position, so both kinds take
 * one and the two sequences cannot collide.
 */
export type _Names = readonly (_Hoisted | null)[]

/** The table being written, and the hoisted values named so far. */
export type _Scope = {
    readonly a: Analysis
    readonly names: _Names
}

/** A statement and the names it left behind. */
export type _Statement = {
    readonly text: List<string>
    readonly names: _Names
}

/** An operand of the root: an anchor, or the value the module exports. */
export type _Root = readonly Operand[]
