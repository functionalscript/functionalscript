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
 * is written with them, `-` because it is a prefix operator, read by the
 * grammar rather than folded into the literal after it, and the rest —
 * `+ * / % **`, `=== !== > >= < <=`, `& | ^ ~ << >> >>>` — Stage A of
 * [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md):
 * every one of them arithmetic, strict comparison, or bitwise, each already
 * a kind of its own on `JsToken`, so the DJS layer only has to admit it.
 */
export type DjsToken = |
  {readonly kind: 'true' | 'false' | 'null' | 'undefined' | 'NaN' | 'Infinity'} |
  {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | '.' | '=' | ';' | '(' | ')' | '=>' | '...' | '-'
    | '+' | '*' | '/' | '%' | '**'
    | '===' | '!==' | '>' | '>=' | '<' | '<='
    | '&' | '|' | '^' | '~' | '<<' | '>>' | '>>>'
  } |
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
