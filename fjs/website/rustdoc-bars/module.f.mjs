/**
 * Writes the site's header, footer and their stylesheet for `cargo doc`, and
 * nothing else: `npm run rustdoc-bars`.
 *
 * rustdoc puts the bars on every page it writes when `cargo doc` is given
 * these files, so they have to exist before it runs, and the generator copies
 * what it wrote afterwards. Writing them here, rather than from the
 * generator, is what lets a build run the generator once:
 *
 * ```bash
 * npm run rustdoc-bars
 * cargo clean --doc
 * RUSTDOCFLAGS="--html-before-content $PWD/_rustdoc-header.html --html-after-content $PWD/_rustdoc-footer.html --extend-css $PWD/_rustdoc.css" cargo doc --no-deps --workspace
 * npm run website
 * ```
 *
 * It reads the same {@link _readBuild} the pages are built from — a preview's
 * branch and commit, and the funding channels — and walks nothing, so it takes
 * milliseconds where the generator takes seconds.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { Access, NodeProgramOptions, ReadFile, Rm, Write, WriteBytes, WriteFile } from '../../effects/node/types.ts'
 * @import { Build } from '../page/types.ts'
 */

import { step } from '../../effects/module.f.mjs'
import { exitStep, writeUtf8File } from '../../effects/node/module.f.mjs'
import { rustdocFooter, rustdocFooterPath, rustdocHeader, rustdocHeaderPath, rustdocStylesheetPath } from '../cargo-doc/module.f.mjs'
import { rustdocStylesheet } from '../style/module.f.js'
import { _readBuild } from '../module.f.mjs'

/**
 * The three files, written for `build`.
 *
 * @type {(build: Build) => Effect<Rm | WriteBytes | WriteFile, void, IoChannel>}
 */
export const writeRustdocBars = build => {
    const headerWritten = writeUtf8File(rustdocHeaderPath, rustdocHeader(build))
    const footerWritten = step(headerWritten, () => writeUtf8File(rustdocFooterPath, rustdocFooter(build.funding)))
    return step(footerWritten, () => writeUtf8File(rustdocStylesheetPath, rustdocStylesheet))
}

/** @type {(options: NodeProgramOptions) => Effect<Access | ReadFile | Rm | Write | WriteBytes | WriteFile, 0, number>} */
export const main = ({ env }) => {
    const build = _readBuild(env)
    const written = step(build, writeRustdocBars)
    return exitStep(written)
}
