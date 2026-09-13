import { stringToList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { tokenize } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'
import { stringifyAsTree } from '../../djs/serializer/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'

// DjsTokenWithMetadata carries bigint fields that JSON.stringify cannot
// serialize — the DJS tree serializer can, and this is a proof-local dump.
const stringify = stringifyAsTree(sort)

export const proof = {
    // DJS-level: keyword remapping and '-'-folding on top of the JS tokenizer. Doesn't re-test
    // JS-level token shapes already covered above/elsewhere in this file.
    djsTokenize: [
        () => {
            // `;` is a token of its own — the statement terminator DataJS
            // requires and the module grammar accepts — not an error
            const result = toArray(tokenize(stringToList(';'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":";"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // keywords other than the literals become plain ids
            const result = toArray(tokenize(stringToList('break'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"id","value":"break"}},{"metadata":{"column":6,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // `NaN` and `Infinity` are literals, kept as keywords like `undefined`
            const result = toArray(tokenize(stringToList('NaN Infinity'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"NaN"}},{"metadata":{"column":4,"line":1,"path":""},"token":{"kind":"ws"}},{"metadata":{"column":5,"line":1,"path":""},"token":{"kind":"Infinity"}},{"metadata":{"column":13,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // a `-` folds into `Infinity` as into a number: one token, the word
            const result = toArray(tokenize(stringToList('-Infinity'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"-Infinity"}},{"metadata":{"column":10,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // and into nothing else: `-NaN` is not a value, as in DataJS
            const result = toArray(tokenize(stringToList('-NaN'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"NaN"}},{"metadata":{"column":5,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('-10'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"number","value":"-10"}},{"metadata":{"column":4,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('-0'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"number","value":"-0"}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('-1234567890n'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"bigint","value":-1234567890n}},{"metadata":{"column":13,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // `js/tokenizer` merges '--' into one decrement-operator token, so
            // this never enters (or re-enters) minus-state via a second '-';
            // it's one error straight from the default state's unknown-token
            // fallback, mapping the whole '--' token to a single error.
            const result = toArray(tokenize(stringToList('--'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('---'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":4,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":4,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // dangling '-' at eof
            const result = toArray(tokenize(stringToList('-'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // '-' followed by neither a number/bigint nor eof: one error for
            // the dangling '-', then the following token maps through normally.
            const result = toArray(tokenize(stringToList('-{'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"{"}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('[-1234567890n]'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"["}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"bigint","value":-1234567890n}},{"metadata":{"column":14,"line":1,"path":""},"token":{"kind":"]"}},{"metadata":{"column":15,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // grammar-level tokenizer error position flows through the DJS wrapper unchanged
            const result = toArray(tokenize(stringToList('00'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"error","message":"invalid number"}}]')
        },
    ],
}
