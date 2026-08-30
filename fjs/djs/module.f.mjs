/**
 * High-level DJS API for parsing, transpiling, and serializing modules.
 *
 * @module
 *
 * @import { Result } from '../types/result/types.ts'
 * @import { Unknown, _CompileOp } from './types.ts'
 * @import { ParseError } from './parser/types.ts'
 * @import { Effect } from '../effects/types.ts'
 */

import { transpile } from './transpiler/module.f.mjs'
import { stringify, stringifyAsTree } from './serializer/module.f.mjs'
import { sort } from '../types/object/module.f.mjs'
import { resultStep } from '../effects/module.f.mjs'
import { errorExit, exitStep, writeUtf8File } from '../effects/node/module.f.mjs'

/**
 * Where an error happened, as much of it as is known: the token's
 * `path:line:column` when the reader tracks positions, and otherwise the name
 * of the file being compiled. A `.json` input is read by `fjs/media/json`,
 * whose errors carry no position, and a missing file or a circular dependency
 * has no token to point at either.
 *
 * An error that knows how far the offending source runs renders as a span,
 * `path:line:column-column` within one line and `path:line:column-line:column`
 * across several. Only lexical errors carry one today; a grammar failure points
 * at a single token and prints the point form.
 *
 * @type {(inputFileName: string) => (parseError: ParseError) => string}
 */
const errorLocation = inputFileName => ({ metadata, end }) => {
    if (metadata === null) { return inputFileName }
    const start = `${metadata.path}:${metadata.line}:${metadata.column}`
    if (end === undefined) { return start }
    // the path is printed once — a token does not straddle files — and the
    // line is dropped from the far end when the span stays on one line, so the
    // common case reads `a.js:1:1-7` rather than repeating `1:`
    const far = end.line === metadata.line
        ? `${end.column}`
        : `${end.line}:${end.column}`
    return `${start}-${far}`
}

/**
 * Compiles the DJS module `args[0]` into `args[1]`, serializing as a JSON tree
 * when the output name ends with `.json` and as a module otherwise.
 *
 * Returns the process exit code: `0` once the output file is written, `1` on
 * every failure — too few arguments, a missing input file, or a parse error —
 * so a caller can detect a failed compile from the exit status alone.
 *
 * @type {(args: readonly string[]) => Effect<_CompileOp, 0, number>}
 */
export const compile = args => {
    if (args.length < 2) {
        return errorExit('Error: Requires 2 or more arguments')
    }
    const inputFileName = args[0]
    const outputFileName = args[1]
    return resultStep(
        transpile(inputFileName),
        /** @type {(result: Result<Unknown, ParseError>) => Effect<_CompileOp, 0, number>} */
        (result) => {
            if (result[0] === 'error') {
                return errorExit(`${errorLocation(inputFileName)(result[1])} - error: ${result[1].message}`)
            }
            const content = outputFileName.endsWith('.json')
                ? stringifyAsTree(sort)(result[1])
                : stringify(sort)(result[1])
            return exitStep(writeUtf8File(outputFileName, content))
        })
}
