# Tokenizer

`tokenize` cuts JavaScript text into tokens: keywords, identifiers, numbers,
strings, templates, punctuation, comments and whitespace. It reads with the
token grammar [`fjs/ebnf/lib/js`](../../ebnf/lib/js/module.f.mjs), one token
at a time, and folds what it read into a `JsToken` stream.
[`module.f.mjs`](./module.f.mjs) holds it, and the token types are in
[`ebnf/lib/js/types.ts`](../../ebnf/lib/js/types.ts).

```js
import { tokenize } from './module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.mjs'

const tokens = toArray(tokenize(toArray(stringToCodePointList('const x = 1n')))('a.f.mjs'))
tokens.map(t => t.token)
// [{ kind: 'const' }, { kind: 'ws' }, { kind: 'id', value: 'x' }, { kind: 'ws' },
//  { kind: '=' }, { kind: 'ws' }, { kind: 'bigint', value: 1n }, { kind: 'eof' }]
```

The input is a list of code points, and the second argument is the file path
each token's metadata carries, so an error can say where it is. Every token
comes with its position.

The demo on this page runs `tokenize` on what you type and lists every token,
whitespace and comments included.

## What it decides

- **Whitespace is one token.** A run of spaces and newlines is a single `nl`
  token when it holds a newline, and `ws` otherwise. A parser that cares about
  line breaks, as JavaScript's automatic semicolons do, checks for `nl`.
- **A word is a keyword or an identifier**, by
  [`keywords`](../keywords/README.md).
- **A number is a `number` or a `bigint`.** A number directly followed by a
  word or another number, such as `123abc` or `00`, is the error
  `invalid number`.
- **Templates keep both spellings.** Each chunk of a template literal carries
  its cooked value and its exact source text.

## Errors

An error is the whole output: the stream is a single `error` token, the first
problem in document order. The kinds are a block comment the input ends inside
(`*/ expected`), a number cut short or run into a word (`invalid number`), and a
token the grammar refuses (`invalid token`). Nothing after a lexical failure is
a token, so the tokenizer stops there rather than guessing.

## Who reads it

[`fjs/compiler/tokenizer`](../../compiler/tokenizer/module.f.mjs) folds this
stream once more into the compiler's tokens, and the website's demos read it
to colour source code. It replaced a hand-written scanner and matched its
stream token for token on everything that scanner accepted.
