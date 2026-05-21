/**
 * High-level DJS API for parsing, transpiling, and serializing modules.
 *
 * @module
 */
import type { Primitive as JsonPrimitive } from '../json/module.f.ts'
import { transpile } from './transpiler/module.f.ts'
import { stringify, stringifyAsTree } from './serializer/module.f.ts'
import { sort } from '../types/object/module.f.ts'
import { encodeUtf8, toVec } from '../types/uint8array/module.f.ts'
import { type Effect, pure } from '../types/effects/module.f.ts'
import {
    error as logError, writeFile,
    type Error as ConsoleError, type WriteFile, type ReadFile,
} from '../types/effects/node/module.f.ts'

export type Object = {
   readonly [k in string]: Unknown
}

export type Array = readonly Unknown[]

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Primitive | Object | Array

type CompileOp = ReadFile | WriteFile | ConsoleError

export const compile: (args: readonly string[]) => Effect<CompileOp, number>
    = args => {
        if (args.length < 2) {
            return logError('Error: Requires 2 or more arguments').step(() => pure(1))
        }
        const inputFileName = args[0]
        const outputFileName = args[1]
        return transpile(inputFileName).step((result): Effect<CompileOp, number> => {
            if (result[0] === 'error') {
                const metadata = result[1].metadata
                return logError(`${metadata?.path}:${metadata?.line}:${metadata?.column} - error: ${result[1].message}`).step(() => pure(0))
            }
            const content = outputFileName.endsWith('.json')
                ? stringifyAsTree(sort)(result[1])
                : stringify(sort)(result[1])
            return writeFile(outputFileName, toVec(encodeUtf8(content))).step(() => pure(0))
        })
    }
