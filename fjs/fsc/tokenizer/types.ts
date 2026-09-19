/**
 * Type-level API for `fjs/fsc/tokenizer/module.f.mjs`: the DJS token shapes
 * `tokenize` produces.
 *
 * @module
 */

import type {
    StringToken,
    NumberToken,
    ErrorToken,
    IdToken,
    BigIntToken,
    WhitespaceToken,
    NewLineToken,
    CommentToken,
    EofToken,
    TokenMetadata,
} from '../../ebnf/lib/js/types.ts'

/**
 * DJS-level token set: a narrower view of JsToken (only the literal keywords
 * survive as bare keywords — `true`, `false`, `null` and the three
 * `literalGlobals` of `fjs/js/keywords`; every other keyword becomes an id)
 * plus its own punctuator kinds. `;` is a member because a statement may
 * end with one — see the module-structure rule in `spec/README.md`, and
 * DataJS, which requires it — `(`, `)`, `...` and `=>` because a function
 * is written with them, and `-` because it is the language's one prefix
 * operator, read by the grammar rather than folded into the literal after
 * it.
 */
export type DjsToken = |
  {readonly kind: 'true' | 'false' | 'null' | 'undefined' | 'NaN' | 'Infinity'} |
  {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | '.' | '=' | ';' | '(' | ')' | '=>' | '...' | '-' } |
  StringToken |
  NumberToken |
  ErrorToken |
  IdToken |
  BigIntToken |
  WhitespaceToken |
  NewLineToken |
  CommentToken |
  EofToken

export type DjsTokenWithMetadata = {readonly token: DjsToken, readonly metadata: TokenMetadata}
