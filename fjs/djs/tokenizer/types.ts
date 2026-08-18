/**
 * Type-level API for `fjs/djs/tokenizer/module.f.mjs`: the DJS token shapes
 * `tokenize`/`tokenizeJs`/`tokenizeString` produce.
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
} from '../../js/tokenizer/types.ts'

/**
 * DJS-level token set: a narrower view of JsToken (only true/false/null/undefined survive
 * as bare keywords; every other keyword becomes an id) plus its own punctuator kinds.
 */
export type DjsToken = |
  {readonly kind: 'true' | 'false' | 'null' | 'undefined'} |
  {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | '.' | '=' } |
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
