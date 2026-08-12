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
import { pure, step } from '../effects/module.f.mjs'
import { writeUtf8File, error } from '../effects/node/module.f.mjs'

/** @typedef {ReadFile | WriteFile | Write} _CompileOp */

/** @type {(args: readonly string[]) => Effect<_CompileOp, number>} */
export const compile = args => {
    if (args.length < 2) {
        return step(
            error('Error: Requires 2 or more arguments'),
            () => pure(1))
    }
    const inputFileName = args[0]
    const outputFileName = args[1]
    return step(
        transpile(inputFileName),
        /** @type {(result: Result<Unknown, ParseError>) => Effect<_CompileOp, number>} */
        (result) => {
            if (result[0] === 'error') {
                const metadata = result[1].metadata
                return step(
                    error(`${metadata?.path}:${metadata?.line}:${metadata?.column} - error: ${result[1].message}`),
                    () => pure(0))
            }
            const content = outputFileName.endsWith('.json')
                ? stringifyAsTree(sort)(result[1])
                : stringify(sort)(result[1])
            return step(
                writeUtf8File(outputFileName, content),
                () => pure(0))
        })
}
