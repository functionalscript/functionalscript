import { type DjsToken, tokenize } from './djs/tokenizer/module.f.ts'
import { parseFromTokens } from './djs/parser/module.f.ts'
import { djsModuleStringify } from './djs/serializer/module.f.ts'
import { toArray } from './types/list/module.f.ts'
import { sort } from './types/object/module.f.ts'
import { stringToList } from './text/utf16/module.f.ts'
import * as fs from 'node:fs'
import * as process from 'node:process'

const tokenizeString
    : (s: string) => readonly DjsToken[]
    = s => toArray(tokenize(stringToList(s)))

const stringifyDjsModule = djsModuleStringify(sort)

const args = process.argv.slice(2)

if (args.length < 2) {
  console.log('Error: Requires 2 or more arguments');
  process.exit();
}

const inputFileName = args[0]
const outputFileName = args[1]
const input = fs.readFileSync(inputFileName).toString()
const tokenList = tokenizeString(input)
const djsModule = parseFromTokens(tokenList)
switch (djsModule[0])
{
    case 'ok': {
        const output = stringifyDjsModule(djsModule[1])
        fs.writeFileSync(outputFileName, output)
        break
    }
    case 'error': {
        console.log(`Parse error: ${djsModule[1]}`);
        process.exit();
    }
}
