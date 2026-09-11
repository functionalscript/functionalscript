/**
 * Type-level API of the class-by-role matrix: what it is generated from.
 * The matrix itself is `spec/datajs/vectors/matrix.md`, and the prose that
 * says why it exists is `spec/datajs/vectors/README.md`.
 *
 * @module
 */

import type { Base } from '../types.ts'

/**
 * A class a role owes no vector, and why — the corpus's own answer to an
 * empty cell, since the generator refuses one it has no answer for. It is
 * a record like any other, so a reason is reviewed with the vectors rather
 * than settled in a generator.
 */
export type NotApplicable = {
    readonly class: string
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
