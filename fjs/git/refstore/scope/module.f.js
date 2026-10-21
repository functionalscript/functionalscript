/**
 * Which of a repository's two directories owns a ref name: the shared one, or
 * the worktree's own — see {@link Dirs}.
 *
 * Nothing here runs an effect. [`fjs/git/refstore`](../module.f.mjs) asks
 * {@link dirOf} which file a name is read from and divides its walks of `refs/`
 * between {@link sharedScope} and {@link worktreeScope};
 * [`../write`](../write/module.f.mjs) asks {@link dirOf} which file a name is
 * written to. Every rule was measured against Git 2.43.0 rather than read off a
 * manual page, and the measurements are at each one.
 *
 * @module
 *
 * @import { Dirs } from '../types.ts'
 * @import { _Scope } from './types.ts'
 */

import { charIs, isLatinCapitalLetter } from '../../../text/ascii/module.f.js'

/** Whether a character is an upper-case Latin letter. */
const isCapital = charIs(isLatinCapitalLetter)

/**
 * Whether a name is spelled the way Git spells a *pseudoref*: every character an
 * upper-case letter, `-` or `_`, and at least one of them.
 *
 * This is a rule about spelling and not a list of names, which an earlier
 * revision had it as — nine names Git's own documentation calls the ones the
 * rule is "usually useful" for. Measured on Git 2.43.0 by writing a different id
 * into each directory and asking a linked worktree:
 *
 * | name | both present | shared only | worktree only |
 * | --- | --- | --- | --- |
 * | `ORIG_HEAD` | the worktree's | no such ref | the worktree's |
 * | `BISECT_EXPECTED_REV` | the worktree's | no such ref | the worktree's |
 * | `MERGE_AUTOSTASH` | the worktree's | no such ref | the worktree's |
 * | `FOO_BAR`, `FOO-BAR`, `_FOO`, `FOO_`, `F` | the worktree's | no such ref | the worktree's |
 * | `FOO1`, `Foo`, `lowercase` | the shared one | the shared one | no such ref |
 *
 * So a name nobody has ever heard of is per worktree if it is spelled like one,
 * and a name with a digit in it is not. The last row is what makes it a syntax
 * rule rather than a longer list: `FOO1` differs from `FOO_BAR` only in a
 * character class.
 *
 * The other direction matters too. A pseudoref-shaped name is read from the
 * worktree's directory *only* — the shared-only column is "no such ref", not a
 * fallback — which is why {@link dirOf} chooses one directory rather than trying
 * both.
 *
 * @type {(text: string) => boolean}
 */
const isPseudoref = text =>
    text.length !== 0
    && [...text].every(c => isCapital(c) || c === '-' || c === '_')

/**
 * The prefixes under `refs/` that are per worktree.
 *
 * Not pseudorefs — they are lower-case and hold a `/` — and still the
 * worktree's: measured, a linked worktree answers its own `refs/bisect/good`,
 * and one left in the *shared* directory is invisible to that worktree
 * entirely. So "per worktree" is these two rules and neither alone.
 */
const perWorktreePrefixes = /** @type {readonly string[]} */ ([
    'refs/bisect/', 'refs/worktree/', 'refs/rewritten/',
])

/** @type {(text: string) => boolean} */
const isPerWorktree = text =>
    isPseudoref(text) || perWorktreePrefixes.some(p => text.startsWith(p))

/** @type {(text: string) => boolean} */
const isShared = text => !isPerWorktree(text)

/**
 * The two walks of `refs/` divide the names between them, and a *directory* is
 * where that division has to be asked differently: `keep` is a rule about a
 * whole ref name, and a directory is a prefix of names that do not exist yet.
 *
 * `refs/bisect` is the case. It is not itself a per-worktree name — the rule is
 * the prefix `refs/bisect/`, with the slash — so the shared walk's `isShared`
 * says "mine" about the directory and "not mine" about every ref inside it. It
 * listed a subtree it then dropped whole, which is a `readdir` of a directory
 * this walk has no name to take from it, and a directory another worktree is
 * free to remove while a `git bisect reset` runs: a listing that fails there is
 * the channel's, so a lookup could fail over refs it would never have answered.
 *
 * So each walk carries a second rule, about a prefix rather than a name:
 *
 * - the shared walk descends unless **every** name under the prefix is per
 *   worktree, which is {@link holdsPerWorktreeOnly};
 * - the worktree's walk descends only where **some** name under it could be,
 *   which is {@link mayHoldPerWorktree} — so it no longer walks `refs/heads`
 *   and the rest of the tree to drop every leaf, and in a main worktree, where
 *   both walks read one directory, the tree is listed once rather than twice.
 *
 * The pseudoref half of {@link isPerWorktree} is no part of either: a walk that
 * starts at `refs` produces names holding a `/`, and those are never spelled
 * like a pseudoref.
 *
 * @type {(text: string) => boolean}
 */
const holdsPerWorktreeOnly = text => perWorktreePrefixes.some(p => `${text}/`.startsWith(p))

/** @type {(text: string) => boolean} */
const mayHoldPerWorktree = text =>
    perWorktreePrefixes.some(p => p.startsWith(`${text}/`) || `${text}/`.startsWith(p))

/** What the walk of the shared directory owns: every name no worktree keeps for itself. */
export const sharedScope = /** @type {_Scope} */ ({
    keep: isShared,
    descend: text => !holdsPerWorktreeOnly(text),
})

/** And what a worktree's own walk owns: the per-worktree names, and nothing else. */
export const worktreeScope = /** @type {_Scope} */ ({
    keep: isPerWorktree,
    descend: mayHoldPerWorktree,
})

/**
 * Which of the two directories a name's loose file sits in.
 *
 * For a main worktree the answer is the same either way, since a caller passes
 * one directory twice. For a linked worktree it is the whole difference between
 * its own `HEAD` and the main worktree's — see {@link Dirs}.
 *
 * One directory and not both, because Git reads one: a pseudoref-shaped name
 * present only in the shared directory is no ref at all to a linked worktree,
 * measured — see {@link isPseudoref}.
 *
 * @type {(dirs: Dirs, text: string) => string}
 */
export const dirOf = (dirs, text) => isPerWorktree(text) ? dirs.gitdir : dirs.common
