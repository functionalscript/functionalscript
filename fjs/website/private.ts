/**
 * Types for the website generator's own reading of the tree: the walk's record
 * of a directory, and the import graph the blocker scan is answered from.
 *
 * A `private.ts` and not a `types.ts`: nothing outside this directory names
 * them — what the generator produces is a *site*, and a page is HTML rather
 * than an API a consumer imports — and they are here rather than inline
 * because [`../AGENTS.md`](../AGENTS.md) §3 keeps named types out of authored
 * `.mjs`.
 *
 * @module
 */

import type { OrderedMap } from '../types/ordered_map/types.ts'
import type { PageDemo } from './page/types.ts'

/**
 * What one module's source says about linking it in a browser: the specifiers
 * that would stop it, and the sibling modules it reaches.
 *
 * The two are the same list read twice, split by where each specifier leads.
 * A relative one that `fjs/path/import`'s `resolve` admits names a file this
 * scan can follow, and is kept as the path it resolves to. Anything else is a
 * blocker, kept as written: a bare package or a `node:` builtin, because a
 * browser has nowhere to resolve it from, and a relative specifier `resolve`
 * refuses, because it names no file — `./bad%` decodes to nothing.
 *
 * @internal
 */
export type _Imports = {
    readonly blockers: readonly string[]
    readonly local: readonly string[]
}

/**
 * Every module the scan has read, by path. A module is read once however many
 * others import it, which is the whole reason the graph is built before it is
 * asked any questions.
 *
 * @internal
 */
export type _Graph = OrderedMap<_Imports>

/**
 * One directory as the walk found it: everything in it, unfiltered.
 *
 * The walk answers what the filesystem holds and nothing more — which files
 * are authored modules, which directories deserve pages, and which names are
 * generated output are all questions asked of this record afterwards, by the
 * one consumer that cares. Two consumers already ask different questions of
 * it: proof selection wants the `.f.mjs` files, a page wants the ones a
 * reader would open.
 *
 * @internal
 */
export type _Walked = {
    readonly path: string
    readonly files: readonly string[]
    readonly dirs: readonly string[]
}

/**
 * Each directory's demo module, by directory path, as the page loads it.
 *
 * A directory whose demo was refused is simply absent: the decision is made
 * once over all of that directory's candidates, so nothing later can revisit
 * it and no entry has to stand for "refused".
 *
 * @internal
 */
export type _DemoPaths = OrderedMap<string>

/**
 * Each directory's demo, by directory path, with the first view the build
 * rendered for it.
 *
 * @internal
 */
export type _Demos = OrderedMap<PageDemo>

/**
 * One kind of thing the reader did to a demo's field that a render must not
 * take away — its size, its focus, its scroll — as the demo runtime keeps it.
 *
 * `capture` reads it off a field, `null` for a field that has nothing worth
 * keeping; `restore` puts it back on the field of the same name after the
 * render. Finding that field is the runtime's, once, for every kind.
 *
 * @internal
 */
export type _FieldMemory<V> = {
    readonly capture: (el: HTMLElement) => V | null
    readonly restore: (el: HTMLElement, v: V) => void
}
