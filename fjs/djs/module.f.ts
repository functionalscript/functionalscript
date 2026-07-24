/**
 * High-level DJS API for parsing, transpiling, and serializing modules.
 *
 * @module
 */
import type { Primitive as JsonPrimitive } from '../media/json/module.f.ts'
import { transpile } from './transpiler/module.f.ts'
import { stringify, stringifyAsTree } from './serializer/module.f.ts'
import { sort } from '../types/object/module.f.ts'
import { step, type Effect, pure } from '../effects/module.f.ts'
import {
    writeUtf8File,
    type WriteFile, type ReadFile,
    type Write,
    error,
} from '../effects/node/module.f.ts'

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Primitive | Object | Array

type CompileOp = ReadFile | WriteFile | Write

export const compile: (args: readonly string[]) => Effect<CompileOp, number>
    = args => {
        if (args.length < 2) {
            return step(error('Error: Requires 2 or more arguments'),
                () => pure(1))
        }
        const inputFileName = args[0]
        const outputFileName = args[1]
        return step(transpile(inputFileName), (result): Effect<CompileOp, number> => {
            if (result[0] === 'error') {
                const metadata = result[1].metadata
                return step(error(`${metadata?.path}:${metadata?.line}:${metadata?.column} - error: ${result[1].message}`),
                    () => pure(0))
            }
            const content = outputFileName.endsWith('.json')
                ? stringifyAsTree(sort)(result[1])
                : stringify(sort)(result[1])
            return step(writeUtf8File(outputFileName, content),
                () => pure(0))
        })
    }
