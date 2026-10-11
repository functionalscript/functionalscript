/**
 * The Rust API reference: where rustdoc's output is read from, where the site
 * publishes it, and the page that lists the crates it documents.
 *
 * **rustdoc's pages are published as they are.** One `cargo doc --workspace`
 * writes one search index and one `static.files/` for every crate, so the
 * whole of `target/doc` moves under {@link cargoDocDir} together, and nothing
 * here rewrites it. The one page that is ours is {@link cargoDocPage}: stable
 * rustdoc writes no root page, and that page is also the way back to the rest
 * of the site.
 *
 * @module
 *
 * @import { Element } from '../../media/html/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Build } from '../page/types.ts'
 */

import { pageTitle, shell } from '../page/module.f.mjs'

/**
 * Where `cargo doc` writes, which the build reads and never serves: `target/`
 * holds build artifacts beside the docs.
 *
 * @type {string}
 */
export const rustdocDir = 'target/doc'

/** The root directory the site publishes rustdoc's output under. @type {string} */
export const cargoDocDir = 'cargo.doc'

/**
 * The crate a directory holds, as rustdoc spells it: the directory's path with
 * `/` and `-` read as `_`, so `nanvm/lib` is documented as `nanvm_lib` and
 * `nanvm/effects-node` as `nanvm_effects_node`. That is the workspace's
 * convention — the package in `nanvm/lib` is named `nanvm-lib` — and a
 * directory that breaks it is not linked rather than linked wrong, because
 * only a crate rustdoc documented is.
 *
 * @type {(path: string) => string}
 */
export const crateOf = path => path.split('/').join('_').split('-').join('_')

/**
 * A documented crate's page, root-relative.
 *
 * @type {(crate: string) => string}
 */
export const crateHref = crate => `/${cargoDocDir}/${crate}/index.html`

/** The index of the Rust API reference, root-relative. @type {string} */
export const cargoDocHref = `/${cargoDocDir}/index.html`

/**
 * The index of the Rust API reference: one link per documented crate.
 *
 * @type {(build: Build) => (crates: readonly string[]) => Vec}
 */
export const cargoDocPage = build => crates => shell(build)(pageTitle('Rust API'))(['main',
    ['h1', 'Rust API'],
    ['p', 'The workspace’s crates, documented by ', ['code', 'cargo doc'], '.'],
    ['ul', ...crates.map(crate => /** @type {Element} */ (['li', ['a', { href: crateHref(crate) }, crate]]))],
])
