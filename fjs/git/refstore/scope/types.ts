/**
 * Types for which of a repository's two directories owns a ref name.
 *
 * @module
 */

/**
 * Which names one walk of `refs/` owns: the leaves it keeps, and the directories
 * it descends into.
 *
 * Two rules and not one, because a directory is a *prefix* of names rather than
 * a name: `refs/bisect` is not a per-worktree name and everything inside it is,
 * so a walk that asked `keep` about the directory would list a subtree it then
 * dropped whole. See `holdsPerWorktreeOnly` in the module.
 */
export type _Scope = {
    readonly keep: (text: string) => boolean
    readonly descend: (text: string) => boolean
}
