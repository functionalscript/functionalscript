import type { Io } from '../io/module.f.ts'
import type { Primitive as JsonPrimitive } from '../json/module.f.ts'
import { transpile } from './transpiler/module.f.ts'
import { stringifyWithConst, stringifyWithoutConst } from './serializer/module.f.ts'
import { sort } from '../types/object/module.f.ts'

export type Object = {
   readonly [k in string]: Unknown
}

export type Array = readonly Unknown[]

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Primitive | Object | Array

export const compile = ({ console: { error }, fs, process: { argv } }: Io): Promise<number> => {
    const args = argv.slice(2)
    if (args.length < 2) {
        error('Error: Requires 2 or more arguments')
        return Promise.resolve(1)
    }

    const inputFileName = args[0]
    const outputFileName = args[1]
    const result = transpile(fs)(inputFileName)    
    switch (result[0]) {
        case 'ok': {
            if (outputFileName.endsWith('.json'))
            {
                const output = stringifyWithoutConst(sort)(result[1])
                fs.writeFileSync(outputFileName, output)
                break
            }
            const output = stringifyWithConst(sort)(result[1])
            fs.writeFileSync(outputFileName, output)
            break
        }
        case 'error': {
            error(`Parse error: ${result[1]}`)
            break
        }
    }
    return Promise.resolve(0)
}
