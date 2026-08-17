/**
 * High-level DJS API for parsing, transpiling, and serializing modules.
 *
 * @module
 *
 * @import { Effect } from '../effects/types.ts'
 * @import { WriteFile, ReadFile, Write } from '../effects/node/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Unknown } from './types.ts'
 * @import { ParseError } from './parser/types.ts'
 */

import { transpile } from './transpiler/module.f.mjs'
import { stringify, stringifyAsTree } from './serializer/module.f.mjs'
import { sort } from '../types/object/module.f.mjs'
import { step } from '../effects/module.f.mjs'
import { errorExit, exitStep, writeUtf8File } from '../effects/node/module.f.mjs'

/** @typedef {ReadFile | WriteFile | Write} _CompileOp */

/**
 * Where an error happened, as much of it as is known: the token's
 * `path:line:column` when the reader tracks positions, and otherwise the name
 * of the file being compiled. A `.json` input is read by `fjs/media/json`,
 * whose errors carry no position, and a missing file or a circular dependency
 * has no token to point at either.
 *
 * @type {(inputFileName: string) => (parseError: ParseError) => string}
 */
const errorLocation = inputFileName => ({ metadata }) => metadata === null
    ? inputFileName
    : `${metadata.path}:${metadata.line}:${metadata.column}`

/**
 * Compiles the DJS module `args[0]` into `args[1]`, serializing as a JSON tree
 * when the output name ends with `.json` and as a module otherwise.
 *
 * Returns the process exit code: `0` once the output file is written, `1` on
 * every failure — too few arguments, a missing input file, or a parse error —
 * so a caller can detect a failed compile from the exit status alone.
 *
 * @type {(args: readonly string[]) => Effect<_CompileOp, number>}
 */
export const compile = args => {
    if (args.length < 2) {
        return errorExit('Error: Requires 2 or more arguments')
    }
    const inputFileName = args[0]
    const outputFileName = args[1]
    return step(
        transpile(inputFileName),
        /** @type {(result: Result<Unknown, ParseError>) => Effect<_CompileOp, number>} */
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
