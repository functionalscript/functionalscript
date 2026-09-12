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
     * lists them: what the walk found, minus the generator's own output.
     */
    readonly files: readonly string[]
    /** The subdirectories that have pages of their own, by name. */
    readonly dirs: readonly string[]
    /** The issues in this directory's `todo/`, by file name. */
    readonly todo: readonly string[]
    /**
     * Every proof module in this directory's subtree, named as this page
     * loads it: `./proof.f.mjs` on the directory that holds it, and
     * `./fjs/types/list/proof.f.mjs` at the root. That is also how `fjs t`
     * names it when run from here, which is the point — one test has one name
     * however it is reached.
     */
    readonly proofs: readonly Proof[]
    /**
     * The demo module of this directory, as the root-relative path the page
     * loads it by, or `null` where there is none.
     *
     * Root-relative because the runtime is one module at a fixed depth, and a
     * relative specifier in its `import()` would resolve against it rather
     * than against the page.
     */
    readonly demo: string | null
}

/**
 * One proof module, and what stops a browser linking it.
 *
 * A proof with blockers is named on its page rather than dropped from it: an
 * empty proof list should mean "no proofs here" and nothing else, and a proof
 * that cannot run in a browser is still a proof of that directory.
 */
export type Proof = {
    /** The page-relative specifier, which is also the name the run reports. */
    readonly name: string
    /** Specifiers a browser cannot resolve, empty where it can link the module. */
    readonly blockers: readonly string[]
}
