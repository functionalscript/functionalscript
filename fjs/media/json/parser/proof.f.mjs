/**
 * @import { JsonToken } from '../tokenizer/types.ts'
 * @import { NumberPolicy } from './types.ts'
 */

import { parse as parseWithPolicy } from './module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { stringify as jsonStringify } from '../module.f.mjs'
import { sort } from '../../../types/object/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'
import { assertEq } from '../../../asserts/module.f.mjs'

/** @type {(s: string) => readonly JsonToken[]} */
const tokenizeString = s => toArray(tokenize(stringToList(s)))

/** The structural machine is proved through the ordinary `number` policy. */
/** @type {NumberPolicy<number>} */
const numberPolicy = token => ok(parseFloat(token.value))

const parse = parseWithPolicy(numberPolicy)

const stringify = jsonStringify(sort)

export const proof = {
    valid: [
        () => {
            const tokenList = tokenizeString('null')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",null]')
        },
        () => {
            const tokenList = tokenizeString('true')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",true]')
        },
        () => {
            const tokenList = tokenizeString('false')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",false]')
        },
        () => {
            const tokenList = tokenizeString('0.1')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",0.1]')
        },
        () => {
            const tokenList = tokenizeString('1.1e+2')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",110]')
        },
        () => {
            const tokenList = tokenizeString('"abc"')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok","abc"]')
        },
        () => {
            const tokenList = tokenizeString('[]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",[]]')
        },
        () => {
            const tokenList = tokenizeString('[1]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",[1]]')
        },
        () => {
            const tokenList = tokenizeString('[[]]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",[[]]]')
        },
        () => {
            const tokenList = tokenizeString('[0,[1,[2,[]]],3]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",[0,[1,[2,[]]],3]]')
        },
        () => {
            const tokenList = tokenizeString('{}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[{}]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[{}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"a":true,"b":false,"c":null}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":true,"b":false,"c":null}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"a":{"b":{"c":["d"]}}}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":{"b":{"c":["d"]}}}]') { throw result }
        }
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected end"]')
        },
        // Trailing commas are not valid JSON — strict parser rejects them.
        () => {
            const tokenList = tokenizeString('[1,]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"a":1,}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('"123')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        // A literal control character inside a string is not valid JSON (RFC
        // 8259 §7) even though the shared tokenizer would otherwise accept it.
        () => {
            const tokenList = tokenizeString('"\t"')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"a":"\t"}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[,]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[1 2]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[1,,2]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[]]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('["a"')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected end"]')
        },
        () => {
            const tokenList = tokenizeString('[,1]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[:]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString(']')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{,}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{1:2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"1"2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"1"::2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"1":2,,"3":4')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{}}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"1":2')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected end"]')
        },
        () => {
            const tokenList = tokenizeString('{,"1":2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"a":1 "b":2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[{]}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{[}]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('10-5')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('undefined')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
    ],
    // Regression: closing a container used to pop the parser stack lazily
    // (`drop(1)`, which is `apply(dropStep)` and returns a `Thunk`), leaving one
    // unforced thunk per closed container. The chain was forced only at the end,
    // costing a call-stack frame per container and overflowing at roughly 5000 of
    // them — nested or flat siblings alike — while primitives were unbounded,
    // since they never push or pop. `popStack` in `module.f.mjs` forces the pop
    // instead, which is why these sizes are safe now.
    siblingContainers: [
        () => {
            const [tag, value] = parse(tokenizeString(`[${Array(6000).fill('{}').join(',')}]`))
            assertEq(tag, 'ok')
            assertEq(Array.isArray(value) ? value.length : -1, 6000)
        },
        () => {
            const [tag, value] = parse(tokenizeString(`[${Array(6000).fill('[]').join(',')}]`))
            assertEq(tag, 'ok')
            assertEq(Array.isArray(value) ? value.length : -1, 6000)
        },
        () => {
            const keys = Array.from({ length: 6000 }, (_, i) => `"k${i}":{}`)
            const [tag, value] = parse(tokenizeString(`{${keys.join(',')}}`))
            assertEq(tag, 'ok')
            assertEq(typeof value === 'object' && value !== null ? Object.keys(value).length : -1, 6000)
        },
        () => {
            // deep nesting shares the same stack path and overflowed at 5000
            const [tag] = parse(tokenizeString('['.repeat(5000) + ']'.repeat(5000)))
            assertEq(tag, 'ok')
        },
        () => {
            // baseline that always worked: primitives never touch the stack
            const [tag, value] = parse(tokenizeString(`[${Array.from({ length: 12000 }, (_, i) => i).join(',')}]`))
            assertEq(tag, 'ok')
            assertEq(Array.isArray(value) ? value.length : -1, 12000)
        },
    ],
    // The numeric policy is the parser's only opinion about numbers: it is
    // handed the token, so it reads the exact lexeme, and it may reject one.
    policy: {
        // the lexeme reaches the policy unrounded — `1.0`, `1e0` and `1` are
        // one `number` but three tokens
        exactLexeme: () => {
            /** @type {NumberPolicy<string>} */
            const lexemePolicy = token => ok(token.value)
            const [tag, value] = parseWithPolicy(lexemePolicy)(tokenizeString('[1.0,1e0,1,-0]'))
            assertEq(tag, 'ok')
            assertEq(stringify(value), '["1.0","1e0","1","-0"]')
        },
        // a policy that cannot represent the number fails the parse as an
        // ordinary `Result`, with its own message
        rejected: () => {
            /** @type {NumberPolicy<never>} */
            const rejectPolicy = () => error('no numbers here')
            const [tag, message] = parseWithPolicy(rejectPolicy)(tokenizeString('{"a":[1]}'))
            assertEq(tag, 'error')
            assertEq(message, 'no numbers here')
        },
    },
}
