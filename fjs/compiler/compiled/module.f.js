/**
 * A program held in memory, compiled as `fjs compile` compiles one on disk:
 * what a page shows of a module its reader types, with no file system to
 * read it from or write it to.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Marked } from '../../text/marked/types.ts'
 * @import { Files } from '../demo_files/types.ts'
 */

import { virtualAt } from '../../effects/node/virtual/module.f.js'
import { error, unwrap } from '../../types/result/module.f.js'
import { dirOf, main } from '../demo_files/module.f.js'
import { _outputMarked } from '../module.f.js'
import { vm } from '../../edag/amnesia/module.f.js'
import { read } from '../../edag/value/property/module.f.js'
import { pureOk } from '../../effects/module.f.js'
import runtimeEdag from '../../js/runtime/gen.edag.js'

/**
 * The runtime a data output interprets the example under: `fjs/js/runtime`'s
 * EDAG, which `npm run gen` writes beside its source, evaluated to its export
 * object and read for `runtime`, as the corpus proofs do — the demo has no
 * file system to load the source from.
 *
 * @type {import('../types.ts').RuntimeLoad}
 */
export const runtime = pureOk(/** @type {import('../../edag/value/types.ts').Runtime} */ (unwrap(read(
    vm({ frame: [], args: [] })(/** @type {import('../../edag/types.ts').Exp} */ (/** @type {unknown} */ (runtimeEdag))),
    'runtime'))))

/**
 * `files`, a program with its main module first, compiled to the language
 * `outputFileName` names, as marked text: the output `compile` writes the
 * text of, or why it refuses. A refusal of the main module or of the output
 * is shown without the location the command prints; one of another file is
 * the command's line, which names the file. It is the real compile but for
 * its tail, the directory and the write, so a pane cannot show anything the
 * CLI does not write, which the compiler demo's proof checks against the command.
 *
 * @type {(files: Files) => (outputFileName: string) => Result<Marked, string>}
 */
export const compiledProgram = files => outputFileName => {
    const result = unwrap(virtualAt(dirOf(files))(_outputMarked(runtime)(main, outputFileName))[1])
    const [tag, value] = result
    if (tag === 'error') {
        const [message, diagnostic, source] = value
        // an output's refusal is the pane's own, and the main module's is the
        // box above the panes; another file's names the file, and where in
        // it, as the compiler's source error says which file it is
        const path = source === null ? main : source.metadata?.path ?? source.path
        return error(path === main ? message : diagnostic)
    }
    return result
}

/**
 * `text`, one module, compiled as {@link compiledProgram} compiles a program
 * of one file: what a page that compiles one module shows.
 *
 * @type {(text: string) => (outputFileName: string) => Result<Marked, string>}
 */
export const compiled = text => compiledProgram([[main, text]])
