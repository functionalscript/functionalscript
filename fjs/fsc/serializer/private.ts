/**
 * Implementation-private types of the FunctionalScript writer: what the
 * walk carries, and what a statement is written from.
 *
 * @module
 */

import type { Analysis, Operand } from '../../edag/analysis/types.ts'
import type { List } from '../../types/list/types.ts'

/**
 * What a name of a scope holds: a value hoisted into a `const` — an entry
 * of the table by index, or a number or bigint that stands as an access's
 * base, which has no entry because a primitive takes no index — or a named
 * parameter of the function whose body the scope is, by position. A
 * parameter is not hoisted, but it is a name of the scope exactly as a
 * `const` is, and the first names a body has.
 */
export type _Hoisted = readonly ['entry', number] | readonly ['leaf', number | bigint] | readonly ['parameter', number]

/**
 * What each statement written so far named, in one scope: a hoisted value,
 * or nothing where the statement was an anchor's `const`, which holds a
 * value the scope does not reach. Each slot also carries its generated name. Module output chooses a prefix
 * that cannot collide with an exported binding.
 *
 * A function body starts a list of its own, since it reads only its own
 * names — a reference out of a body reads its frame — holding its named
 * parameters, where it has any, before any statement is written.
 */
export type _Names = readonly (readonly [_Hoisted | null, string])[]

/**
 * The table being written, the hoisted values named so far in the scope
 * being written, and the names its frame's slots read as — none at the
 * module level.
 */
export type _Scope = {
    readonly a: Analysis
    readonly names: _Names
    readonly frame: readonly string[]
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
