import { stringToList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { tokenize } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'

// DjsTokenWithMetadata carries bigint fields that JSON.stringify cannot
// serialize — the compiler's proof dump can.
const stringify = _stringifyTree

export const proof = {
    // DJS-level: keyword remapping on top of the JS tokenizer, and nothing
    // else — the layer holds no state, `-` being a token the grammar reads
    // rather than a sign folded into the literal after it. Doesn't re-test
    // JS-level token shapes already covered above/elsewhere in this file.
    djsTokenize: [
        () => {
            // `;` is a token of its own — the statement terminator DataJS
            // requires and the module grammar accepts — not an error
            const result = toArray(tokenize(stringToList(';'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":";"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // the four tokens a function is written with are tokens of their
            // own, `...` one token where it was three; `..` is no token
            const kinds = toArray(tokenize(stringToList('(...a)=>a'))('')).map(t => t.token.kind)
            assertEq(kinds.join(' '), '( ... id ) => id eof')
            const dots = toArray(tokenize(stringToList('..'))('')).map(t => t.token.kind)
            assertEq(dots.join(' '), 'error')
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
            // `-` is a token of its own, and folds into nothing: `-Infinity`
            // is the prefix and the word, where it was one word, and the
            // position it reports is the `-`'s rather than what followed it
            const result = toArray(tokenize(stringToList('-Infinity'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"Infinity"}},{"metadata":{"column":10,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // `-NaN` is two tokens like any other prefix, where the fold made
            // it an error: what the grammar does with them is the grammar's
            const kinds = toArray(tokenize(stringToList('-NaN'))('')).map(t => t.token.kind)
            assertEq(kinds.join(' '), '- NaN eof')
        },
        () => {
            // a number keeps its own text and the sign stands before it, so
            // `-10` is two tokens and the number is `10`
            const result = toArray(tokenize(stringToList('-10'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"number","value":"10"}},{"metadata":{"column":4,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // `-0` likewise: the sign is no longer part of the lexeme, and
            // what `-0` is worth the reader works out
            const result = toArray(tokenize(stringToList('-0'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"number","value":"0"}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // and a bigint keeps its own value, unnegated
            const result = toArray(tokenize(stringToList('-1234567890n'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"bigint","value":1234567890n}},{"metadata":{"column":13,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // `js/tokenizer` merges '--' into one decrement-operator token,
            // which this language has no rule for: one error, and no state
            // here for a second '-' to enter
            const result = toArray(tokenize(stringToList('--'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // so `---` is that error and then a prefix
            const kinds = toArray(tokenize(stringToList('---'))('')).map(t => t.token.kind)
            assertEq(kinds.join(' '), 'error - eof')
        },
        () => {
            // a lone '-' is a token, where the fold made it an error at eof
            const result = toArray(tokenize(stringToList('-'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // and a '-' before anything else is a token too: `-{` is the
            // prefix and the brace, which the grammar reads as an object
            const kinds = toArray(tokenize(stringToList('-{'))('')).map(t => t.token.kind)
            assertEq(kinds.join(' '), '- { eof')
        },
        () => {
            const kinds = toArray(tokenize(stringToList('[-1234567890n]'))('')).map(t => t.token.kind)
            assertEq(kinds.join(' '), '[ - bigint ] eof')
        },
        () => {
            // grammar-level tokenizer error position flows through the DJS wrapper unchanged
            const result = toArray(tokenize(stringToList('00'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"error","message":"invalid number"}}]')
        },
    ],
}
