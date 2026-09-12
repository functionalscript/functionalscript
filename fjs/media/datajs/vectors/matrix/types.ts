/**
 * Type-level API of the class-by-role matrix: what it is generated from.
 * The matrix itself is `spec/datajs/vectors/matrix.md`, and the prose that
 * says why it exists is `spec/datajs/vectors/README.md`.
 *
 * @module
 */

import type { Base } from '../types.ts'

/**
 * What a reason answers, tagged as `Document` is: one cell, every class
 * under a prefix, or every class no set but the named one carries.
 *
 * The last two exist because the bill is otherwise unpayable. A role's
 * column must answer every class in the corpus, and a serializer owes
 * nothing to the several hundred that are document facts — a whitespace
 * rule, a grammar production, a defect a reader refuses. One reason per
 * cell is the same sentence written out hundreds of times, and written
 * again for the next role.
 *
 * `set` is the widest and the most exact: a class no set but `reject`
 * carries is one no other role has a vector for, so a single reason is
 * true of the whole family by construction rather than by inspection.
 */
export type Scope =
    | readonly ['class', string]
    | readonly ['subtree', string]
    | readonly ['set', string]

/**
 * A cell, or a family of cells, a role owes no vector, and why — the
 * corpus's own answer to an empty cell, since the generator refuses one it
 * has no answer for. It is a record like any other, so a reason is reviewed
 * with the vectors rather than settled in a generator.
 *
 * A wider scope is not a licence to be vague: the generator refuses a
 * `subtree` or a `set` reason the moment it reaches a class that *has*
 * vectors for that role, so a reason cannot quietly become untrue of
 * something beneath it.
 */
export type NotApplicable = {
    readonly scope: Scope
    readonly role: string
    readonly because: string
}

/** One set of vectors, under the name the corpus files it by. */
export type RoleSet = readonly [name: string, vectors: readonly Base[]]

/**
 * An implementation role, and the sets the corpus has for it. A role with
 * no sets is one whose vectors have not landed: its column says so, and it
 * refuses nothing, since a class cannot owe a vector to a set that does not
 * exist. The refusal arrives with the set.
 */
export type Role = {
    readonly role: string
    readonly sets: readonly RoleSet[]
}

/** What the matrix is generated from. */
export type Corpus = {
    readonly roles: readonly Role[]
    readonly notApplicable: readonly NotApplicable[]
}
