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
 * What each statement written so far named, in one scope: a hoisted value,
 * or nothing where the statement was an anchor's `const`, which holds a
 * value the scope does not reach. A name is the slot's position, so both
 * kinds take one and the two sequences cannot collide.
 *
 * A function body starts a list of its own, since it reads only its own
 * names — a reference out of a body is a capture.
 */
export type _Names = readonly (_Hoisted | null)[]

/** The table being written, and the hoisted values named so far in the scope being written. */
export type _Scope = {
    readonly a: Analysis
    readonly names: _Names
}

/** A statement and the names it left behind. */
export type _Statement = {
    readonly text: List<string>
    readonly names: _Names
}

/**
 * The operands one scope's statements are written from: an anchor each, and
 * last the value the scope yields — a module's export, or what a function
 * body returns.
 */
export type _Root = readonly Operand[]
