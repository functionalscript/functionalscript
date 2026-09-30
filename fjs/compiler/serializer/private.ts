/**
 * Implementation-private types of the FunctionalScript writer: what the
 * walk carries, and what a statement is written from.
 *
 * @module
 */

import type { Analysis, Operand } from '../../edag/analysis/types.ts'
import type { List } from '../../types/list/types.ts'

/**
 * What each statement written so far named, in one scope: a hoisted entry,
 * by its index in the table, or nothing where the statement was an anchor's
 * `const`, which holds a value the scope does not reach. Each slot also
 * carries its generated name. Module output chooses a prefix that cannot
 * collide with an exported binding.
 *
 * A function body starts a list of its own, since it reads only its own
 * names — a reference out of a body reads its frame.
 */
export type _Names = readonly (readonly [number | null, string])[]

/**
 * The scope being written: the table, the names of the scopes around a
 * block — none for a module or a function body, which reads the scope
 * around it through its frame alone — the hoisted values named so far in
 * this scope, the names its frame's slots read as — none at the module
 * level — the parameter of the function whose body holds the scope, which
 * a read of the arguments is written as, the entries the scope's root
 * reaches eagerly, which are the ones this scope's statements hoist — an
 * entry reached only under a lazy operand is that operand's block's — and
 * the entries written at more than one place under the scope's root, the
 * analysis's for a module or a body and a block's own for a block.
 */
export type _Scope = {
    readonly a: Analysis
    readonly outer: _Names
    readonly names: _Names
    readonly frame: readonly string[]
    readonly param: string
    readonly eager: readonly number[]
    readonly shared: readonly number[]
}

/**
 * The text of an operand, and whether it is a block — a lazy operand
 * written as an IIFE, `(()=>{…})()`, which is a call and takes no
 * parentheses anywhere — or the operand written in place, which takes
 * them where its node's precedence asks.
 */
export type _Written = {
    readonly text: List<string>
    readonly block: boolean
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
