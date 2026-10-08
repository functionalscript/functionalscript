import { stringToList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { tokenize } from './module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { _tokensOf, demo } from './demo.f.mjs'
import { examples } from '../examples/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'

// DjsTokenWithMetadata carries bigint fields that JSON.stringify cannot
// serialize — the compiler's proof dump can.
const stringify = _stringifyTree

export const proof = {
    // Module-level: keyword remapping on top of the JS tokenizer, and nothing
    // else — the layer holds no state, `-` being a token the grammar reads
    // rather than a sign folded into the literal after it. Doesn't re-test
    // JS-level token shapes already covered above/elsewhere in this file.
    djsTokenize: [
        () => {
            // `;` is a token of its own — the statement terminator DataJS
            // requires and the module grammar accepts — not an error
            const result = toArray(tokenize(stringToList(';'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"newline":false,"token":{"kind":";"}},{"metadata":{"column":2,"line":1,"path":""},"newline":false,"token":{"kind":"eof"}}]')
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
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"newline":false,"token":{"kind":"id","value":"break"}},{"metadata":{"column":6,"line":1,"path":""},"newline":false,"token":{"kind":"eof"}}]')
        },
        () => {
            // `NaN` and `Infinity` are literals, kept as keywords like `undefined`
            const result = toArray(tokenize(stringToList('NaN Infinity'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"newline":false,"token":{"kind":"NaN"}},{"metadata":{"column":5,"line":1,"path":""},"newline":false,"token":{"kind":"Infinity"}},{"metadata":{"column":13,"line":1,"path":""},"newline":false,"token":{"kind":"eof"}}]')
        },
        () => {
            // `-` is a token of its own, and folds into nothing: `-Infinity`
            // is the prefix and the word, where it was one word, and the
            // position it reports is the `-`'s rather than what followed it
            const result = toArray(tokenize(stringToList('-Infinity'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"newline":false,"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"newline":false,"token":{"kind":"Infinity"}},{"metadata":{"column":10,"line":1,"path":""},"newline":false,"token":{"kind":"eof"}}]')
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
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"newline":false,"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"newline":false,"token":{"kind":"number","value":"10"}},{"metadata":{"column":4,"line":1,"path":""},"newline":false,"token":{"kind":"eof"}}]')
        },
        () => {
            // `-0` likewise: the sign is no longer part of the lexeme, and
            // what `-0` is worth the reader works out
            const result = toArray(tokenize(stringToList('-0'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"newline":false,"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"newline":false,"token":{"kind":"number","value":"0"}},{"metadata":{"column":3,"line":1,"path":""},"newline":false,"token":{"kind":"eof"}}]')
        },
        () => {
            // and a bigint keeps its own value, unnegated
            const result = toArray(tokenize(stringToList('-1234567890n'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"newline":false,"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"newline":false,"token":{"kind":"bigint","value":1234567890n}},{"metadata":{"column":13,"line":1,"path":""},"newline":false,"token":{"kind":"eof"}}]')
        },
        () => {
            // `js/tokenizer` merges '--' into one decrement-operator token,
            // which this language has no rule for: one error, and no state
            // here for a second '-' to enter
            const result = toArray(tokenize(stringToList('--'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"newline":false,"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":3,"line":1,"path":""},"newline":false,"token":{"kind":"eof"}}]')
        },
        () => {
            // so `---` is that error and then a prefix
            const kinds = toArray(tokenize(stringToList('---'))('')).map(t => t.token.kind)
            assertEq(kinds.join(' '), 'error - eof')
        },
        () => {
            // a lone '-' is a token, where the fold made it an error at eof
            const result = toArray(tokenize(stringToList('-'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":1,"line":1,"path":""},"newline":false,"token":{"kind":"-"}},{"metadata":{"column":2,"line":1,"path":""},"newline":false,"token":{"kind":"eof"}}]')
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
            // Stage B's tokens are tokens of their own, `?` beside `??` —
            // maximal munch reads `??` where two `?` stand together, so a
            // conditional's `?` is one token and the nullish operator
            // another — and `:` is the token a member already uses
            const kinds = toArray(tokenize(stringToList('a&&b||c??d?e:f'))('')).map(t => t.token.kind)
            assertEq(kinds.join(' '), 'id && id || id ?? id ? id : id eof')
            assertEq(toArray(tokenize(stringToList('??'))('')).map(t => t.token.kind).join(' '), '?? eof')
            assertEq(toArray(tokenize(stringToList('? ?'))('')).map(t => t.token.kind).join(' '), '? ? eof')
        },
        () => {
            // `?.` is the optional step's token, one token as `??` is, and
            // `? .` two: a conditional's `?` and an access's `.`
            const kinds = toArray(tokenize(stringToList('a?.b'))('')).map(t => t.token.kind)
            assertEq(kinds.join(' '), 'id ?. id eof')
            assertEq(toArray(tokenize(stringToList('a? .b'))('')).map(t => t.token.kind).join(' '), 'id ? . id eof')
        },
        () => {
            // grammar-level tokenizer error position flows through the module wrapper unchanged
            const result = toArray(tokenize(stringToList('00'))(''))
            assertEq(stringify(result), '[{"metadata":{"column":2,"line":1,"path":""},"newline":false,"token":{"kind":"error","message":"invalid number"}}]')
        },
    ],
    // Trivia is not in the stream; whether a newline stood before a token
    // is: the fact the parser reads of the token after a statement written
    // without its `;`, of the token after `return`, and of an `=>`.
    newline: [
        () => {
            // a token on a new line carries it, a token after a space does
            // not, and the newline is carried across the trivia after it
            const flags = toArray(tokenize(stringToList('a b\nc \n /* x */ d'))('')).map(t => `${t.token.kind}${t.newline ? '+' : ''}`)
            assertEq(flags.join(' '), 'id id id+ id+ eof')
        },
        () => {
            // a line comment ends at a newline, so what follows it is on a
            // new line; a block comment holding a newline is followed by one
            // too; a block comment on the line is not
            assertEq(toArray(tokenize(stringToList('a // c\nb'))('')).map(t => t.newline).join(' '), 'false true false')
            assertEq(toArray(tokenize(stringToList('a /* c\n */ b'))('')).map(t => t.newline).join(' '), 'false true false')
            assertEq(toArray(tokenize(stringToList('a /* c */ b'))('')).map(t => t.newline).join(' '), 'false false false')
        },
        () => {
            // the first token has nothing before it, on the first line or
            // not; `eof` is a token after `a` like any other
            assertEq(toArray(tokenize(stringToList('\na'))('')).map(t => t.newline).join(' '), 'true false')
            // a text of trivia alone is its `eof`
            assertEq(toArray(tokenize(stringToList(' // c'))('')).map(t => t.token.kind).join(' '), 'eof')
        },
    ],
    /**
     * **One line per token, and a token that cannot be read is a line.** A
     * hex escape is the gap: an `error` token, where a keyword such as
     * `typeof` is an ordinary name the parser reads. A string left open
     * runs to the end, which the span says.
     */
    demo: {
        tokens: () => {
            assertEq(_tokensOf('export default [1, "hi", 2n];'), [
                '1:1  id  "export"', '1:8  id  "default"', '1:16  [', '1:17  number  "1"', '1:18  ,',
                '1:20  string  "hi"', '1:24  ,', '1:26  bigint  2n', '1:28  ]', '1:29  ;', '1:30  eof',
            ].join('\n'))
            assert(_tokensOf('export default !1;').includes('1:16  !\n'))
            assertEq(_tokensOf('"bad').split('\n')[0], '1:1  error  invalid token (to 1:5)')
        },
        examples: () => {
            // a hex escape is what the tokenizer cannot read; every other example ends at `eof`
            for (const [name, source] of examples) {
                const tokens = _tokensOf(source)
                assertEq(tokens.includes('  error  '), name === 'Hex escape', name)
                assertEq(tokens.endsWith('eof'), name !== 'Hex escape', name)
            }
            assertEq(_tokensOf('"a\\u0041"').split('\n')[0], '1:1  string  "aA"')
        },
        view: () => {
            const shown = htmlToString(demo.view(demo.init))
            assert(shown.includes('<pre>'), shown)
            assert(shown.includes('1:1  id  '), shown)
        },
    },
}
