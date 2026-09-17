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
 * plus its own punctuator kinds and `-Infinity`, the one word the `-` folds
 * into as it folds into a number. `;` is a member because a statement may
 * end with one — see the module-structure rule in `spec/README.md`, and
 * DataJS, which requires it — and `(`, `)`, `...` and `=>` because a
 * function is written with them.
 */
export type DjsToken = |
  {readonly kind: 'true' | 'false' | 'null' | 'undefined' | 'NaN' | 'Infinity' | '-Infinity'} |
  {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | '.' | '=' | ';' | '(' | ')' | '=>' | '...' } |
  // Stage A operators (`spec/todo/2340-operators.md`): arithmetic, strict
  // comparison, and bitwise. `-` is here too — the operator, not the fold:
  // it reaches this alphabet only where `module.f.mjs`'s `_DjsScanState`
  // decides the token before it is not a negative number, bigint or
  // `-Infinity`, which stay one token each and never reach here as `-`.
  {readonly kind: '+' | '-' | '*' | '/' | '%' | '**' | '===' | '!==' | '>' | '>=' | '<' | '<=' | '&' | '|' | '^' | '~' | '<<' | '>>' | '>>>' } |
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
