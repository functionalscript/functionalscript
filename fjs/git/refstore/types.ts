/**
 * Types for the refs a repository holds, read over the effects.
 *
 * @module
 */

import type { Bytes, Oid } from '../types.ts'

/**
 * The two directories a repository's refs live in.
 *
 * Git keeps most refs once for the whole repository and a few per worktree,
 * and the two sets live in different directories whenever a linked worktree is
 * involved. `common` is what
 * [`fjs/git/repo`](../repo/module.f.mjs)'s `tryCommonDir` answers — where
 * `refs/` and `packed-refs` are — and `gitdir` is the directory that
 * worktree's `.git` names, which holds its own `HEAD` and nothing shared.
 *
 * For a main worktree the two are the same directory, and a caller passes one
 * string twice. For a linked worktree they differ, and passing `common` for
 * both reads the *main* worktree's `HEAD`: measured on Git 2.43.0, a linked
 * worktree detached at another commit answers its own id where the main
 * worktree answers the branch's, so one directory for both is a plausible
 * wrong commit rather than a missing one.
 *
 * Two fields and not one, because neither directory can be derived from the
 * other: `commondir` points from the worktree's directory to the shared one
 * and nothing points back — a repository has as many worktrees as it likes.
 */
export type Dirs = {
    readonly gitdir: string
    readonly common: string
}

/**
 * One ref the repository holds: the name the files spell it under, and the
 * id it effectively names.
 *
 * The name is bytes rather than text, because Git stores and compares a ref
 * name byte for byte and never decodes one. A loose ref's name reaches this
 * module as a path from the host, which node has already decoded as UTF-8,
 * so it is encoded back to bytes to be one name with a `packed-refs` line's.
 *
 * The name carries no meaning beyond telling two refs apart. It comes along
 * because the files hold it, and a consumer that reads a policy into one is
 * outside the design `todo/git-name-resolution.md` fixes.
 */
export type Root = {
    readonly name: Bytes
    readonly id: Oid
}
