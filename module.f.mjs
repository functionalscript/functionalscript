import * as tokenizer from './djs/tokenizer/module.f.mjs'
const { tokenize } = tokenizer
import * as parser from './djs/parser/module.f.mjs'
const { parse } = parser
import * as serializer from './djs/serializer/module.f.mjs'
const { djsModuleStringify } = serializer
import * as list from './types/list/module.f.mjs'
const { toArray } = list
import * as o from './types/object/module.f.mjs'
const { sort } = o
import * as encoding from './text/utf16/module.f.mjs'
import fs from 'node:fs'

/** @type {(s: string) => readonly tokenizer.DjsToken[]} */
const tokenizeString = s => toArray(tokenize(encoding.stringToList(s)))

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
    }
    case 'error': {
        console.log(`Parse error: ${djsModule[1]}`);
        process.exit();
    }
}