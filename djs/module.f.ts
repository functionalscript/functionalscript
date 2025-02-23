import type { Io } from '../io/module.f.ts'
import type { Primitive as JsonPrimitive } from '../json/module.f.ts'
import { transpile } from './transpiler/module.f.ts'
import { stringify } from './serializer/module.f.ts'
import { sort } from '../types/object/module.f.ts'

export type Object = {
   readonly [k in string]: Unknown
}

export type Array = readonly Unknown[]

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Primitive | Object | Array

const stringifyUnknown = stringify(sort)

export const run: (io: Io) => void
 = io => {
   const args = io.process.argv.slice(2)
   if (args.length < 2) {
      io.console.log('Error: Requires 2 or more arguments');
      return;
   }

   const inputFileName = args[0]
   const outputFileName = args[1]
   const result = transpile(io.fs)(inputFileName)
   switch (result[0])
   {
      case 'ok': {
         const output = stringifyUnknown(result[1])
         io.fs.writeFileSync(outputFileName, output)
         break
      }
      case 'error': {
         io.console.log(`Parse error: ${result[1]}`);
         break
      }
   }
 }