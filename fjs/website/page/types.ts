/**
 * Type-level API for the directory page builder.
 *
 * @module
 */

/**
 * One directory of the repository, as the website's walk sees it.
 *
 * The four lists are what a page is built from, and each is already filtered:
 * generated output is not a `file`, `todo` is not a `dir`, and an ignored
 * directory is neither.
 */
export type Dir = {
    /**
     * The directory's repository path, `'.'` at the root and `'fjs/types/list'`
     * below it. It is the page's identity: its `index.html` sits here, its
     * breadcrumb is this path's segments, and every link it writes is this
     * path extended by one name.
     */
    readonly path: string
    /**
     * The authored files in this directory, by name, in the order the page
     * lists them. Empty where the directory holds no `module.f.mjs`: a
     * directory that only groups others has nothing to list, and the rule that
     * gives it a page anyway is what makes every subdirectory link resolve.
     */
    readonly files: readonly string[]
    /** The subdirectories that have pages of their own, by name. */
    readonly dirs: readonly string[]
    /** The issues in this directory's `todo/`, by file name. */
    readonly todo: readonly string[]
}
