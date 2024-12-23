import * as tokenizer from './djs/tokenizer/module.f.ts'
const { tokenize } = tokenizer
import * as parser from './djs/parser/module.f.ts'
const { parse } = parser
import * as serializer from './djs/serializer/module.f.ts'
const { djsModuleStringify } = serializer
import * as list from './types/list/module.f.ts'
const { toArray } = list
import * as o from './types/object/module.f.ts'
const { sort } = o
import * as encoding from './text/utf16/module.f.ts'
import fs from 'node:fs'

const tokenizeString
    : (s: string) => readonly tokenizer.DjsToken[]
    = s => toArray(tokenize(encoding.stringToList(s)))

const stringifyDjsModule = djsModuleStringify(sort)

var args = process.argv.slice(2)

if (args.length < 2) {
  console.log('Error: Requires 2 or more arguments');
  process.exit();
}

const inputFileName = args[0]
const outputFileName = args[1]
const input = fs.readFileSync(inputFileName).toString()
const tokenList = tokenizeString(input)
const djsModule = parse(tokenList)
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
