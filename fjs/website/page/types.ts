/**
 * Type-level API for the directory page builder.
 *
 * @module
 */

import type { Funding } from '../funding/types.ts'
import type { Issue } from '../issue/types.ts'
import type { Element } from '../../media/html/types.ts'

/**
 * A directory's demo, as its page writes it.
 */
export type PageDemo = {
    /**
     * The demo module, as the root-relative path the page loads it by.
     *
     * Root-relative because the runtime is one module at a fixed depth, and a
     * relative specifier in its `import()` would resolve against it rather
     * than against the page.
     */
    readonly path: string
    /**
     * The demo's first view, `view(init)`, rendered by the build so the page
     * shows the demo before the runtime has loaded it; `null` where the build
     * could not render it, and the runtime alone does.
     */
    readonly view: Element | null
}

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
    /**
     * The subdirectories, by name, whose subtree holds a demo — the
     * subdirectory's own or one further down. A subset of `dirs`.
     */
    readonly demoDirs: readonly string[]
    /**
     * The issues under this directory's `todo/`, a subfolder's included,
     * each with its header.
     */
    readonly todo: readonly Issue[]
    /**
     * Every proof module in this directory's subtree, named as this page
     * loads it: `./proof.f.mjs` on the directory that holds it, and
     * `./fjs/types/list/proof.f.mjs` at the root. That is also how `fjs t`
     * names it when run from here, which is the point — one test has one name
     * however it is reached.
     */
    readonly proofs: readonly Proof[]
    /**
     * The directory's `README.md` as the top of its page: its rendering, or
     * the note saying why it is not rendered here; empty where there is no
     * README. Rendered by the build, as the demo's first view is.
     */
    readonly readme: readonly Element[]
    /** The demo of this directory, or `null` where there is none. */
    readonly demo: PageDemo | null
    /**
     * The root-relative link to the API reference of the crate this
     * directory holds, or `null` where it holds none, or its reference was
     * not built.
     */
    readonly api: string | null
    /**
     * The root-relative link to the index of the Rust API reference where a
     * subdirectory holds a documented crate, or `null` where none does.
     */
    readonly apiIndex: string | null
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

/**
 * What the build knows about itself: the commit and the branch from the
 * environment it ran in, and the funding channels from the tree it read.
 *
 * The commit and the branch are `null` for a local build: nothing sets them
 * there, and a link to a commit or a branch nobody pushed opens nothing on
 * GitHub.
 */
export type Build = {
    /**
     * The commit the site was built from, as the lowercase hex GitHub links
     * it by. A listed file opens on GitHub at this commit.
     */
    readonly commit: string | null
    /**
     * The branch the site was built from. Any branch but `main` is a preview,
     * and its pages say which branch and commit they show.
     */
    readonly branch: string | null
    /**
     * The project's funding channels, from `funding.json`, which every
     * page's footer links. Empty for a tree without that file.
     */
    readonly funding: readonly Funding[]
}

/**
 * What one entry of a directory's list is, which is the icon a reader tells
 * it by: a subdirectory, a file, or an issue in the directory's `todo/`.
 */
export type Kind = 'dir' | 'file' | 'issue'
