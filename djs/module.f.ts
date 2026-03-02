import type { Primitive as JsonPrimitive } from '../json/module.f.ts'
import { transpile } from './transpiler/module.f.ts'
import { stringify, stringifyAsTree } from './serializer/module.f.ts'
import { sort } from '../types/object/module.f.ts'
import { encodeUtf8, toVec } from '../types/uint8array/module.f.ts'
import { error, writeFile, type NodeEffect } from '../types/effect/node/module.f.ts'
import { pure } from '../types/effect/module.f.ts'
import type { Fs } from '../io/module.f.ts'

export type Object = {
   readonly [k in string]: Unknown
}

export type Array = readonly Unknown[]

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Primitive | Object | Array

const done = (s: string): NodeEffect<number> => error(s).map(() => 1)

const save = (path: string, source: string): NodeEffect<number> =>
    writeFile(path, toVec(encodeUtf8(source))).pipe(result => {
        if (result[0] === 'error') {
            return done(String(result[1]))
        }
        return pure(0)
    })

export const compile = (fs: Fs) => (args: readonly string[]): NodeEffect<number> => {
    if (args.length < 2) {
        return done('Error: Requires 2 or more arguments')
    }

    const inputFileName = args[0]
    const outputFileName = args[1]
    const result = transpile(fs)(inputFileName)
    switch (result[0]) {
        case 'ok': {
            if (outputFileName.endsWith('.json'))
            {
                return save(outputFileName, stringifyAsTree(sort)(result[1]))
            }
            return save(outputFileName, stringify(sort)(result[1]))
        }
        case 'error': {
            const metadata = result[1].metadata
            return done(`${metadata?.path}:${metadata?.line}:${metadata?.column} - error: ${result[1].message}`)
        }
    }
}
