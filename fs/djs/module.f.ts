/**
 * High-level DJS API for parsing, transpiling, and serializing modules.
 *
 * @module
 */
import { fromIo, type Io } from '../io/module.f.ts'
import type { Primitive as JsonPrimitive } from '../json/module.f.ts'
import { transpile } from './transpiler/module.f.ts'
import { stringify, stringifyAsTree } from './serializer/module.f.ts'
import { sort } from '../types/object/module.f.ts'
import { encodeUtf8 } from '../types/uint8array/module.f.ts'

export type Object = {
   readonly [k in string]: Unknown
}

export type Array = readonly Unknown[]

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Primitive | Object | Array

export const compile = (io: Io) => async (args: readonly string[]): Promise<number> => {
    const { console: { error: logError }, fs } = io
    if (args.length < 2) {
        logError('Error: Requires 2 or more arguments')
        return 1
    }

    const inputFileName = args[0]
    const outputFileName = args[1]
    const result = await fromIo(io)(transpile(inputFileName))
    switch (result[0]) {
        case 'ok': {
            if (outputFileName.endsWith('.json'))
            {
                const output = stringifyAsTree(sort)(result[1])
                fs.writeFileSync(outputFileName, encodeUtf8(output))
                break
            }
            const output = stringify(sort)(result[1])
            fs.writeFileSync(outputFileName, encodeUtf8(output))
            break
        }
        case 'error': {
            const metadata = result[1].metadata
            logError(`${metadata?.path}:${metadata?.line}:${metadata?.column} - error: ${result[1].message}`)
            break
        }
    }
    return 0
}
