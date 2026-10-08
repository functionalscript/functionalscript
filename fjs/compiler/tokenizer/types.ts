/**
 * Type-level API for `fjs/compiler/tokenizer/module.f.mjs`: the module token shapes
 * `tokenize` produces.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { _djsTokenKinds } from './module.f.mjs'
import type {
    StringToken,
    NumberToken,
    ErrorToken,
    IdToken,
    BigIntToken,
    EofToken,
    TokenMetadata,
} from '../../ebnf/lib/js/types.ts'

/**
 * The module's token set: a narrower view of JsToken (only the literal keywords
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
 * a kind of its own on `JsToken`, so this layer only has to admit it —
 * and `&& || ??` with `?`, the lazy operators and the conditional's own
 * token, Stage B of the same; `:` the conditional shares with a member;
 * and `!`, the logical not, the third prefix, admitted after both stages.
 * `?.`, the optional step's, admitted with the optional chains. Trivia
 * is no member: whitespace, newlines and comments are not in the stream,
 * and what a rule reads of them is `newline` on the token after them,
 * {@link DjsTokenWithMetadata}.
 */
export type DjsToken = |
  {readonly kind: 'true' | 'false' | 'null' | 'undefined' | 'NaN' | 'Infinity'} |
  {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | '.' | '=' | ';' | '(' | ')' | '=>' | '...' | '-'
    | '+' | '*' | '/' | '%' | '**'
    | '===' | '!==' | '>' | '>=' | '<' | '<='
    | '&' | '|' | '^' | '~' | '<<' | '>>' | '>>>'
    | '!' | '&&' | '||' | '??' | '?' | '?.'
  } |
  StringToken |
  NumberToken |
  ErrorToken |
  IdToken |
  BigIntToken |
  EofToken

// The kinds are listed a second time, as the value `./module.f.mjs` tests
// membership against; this pin keeps the list and the union agreeing.
type _KindsAreComplete = Assert<Equal<(typeof _djsTokenKinds)[number], DjsToken['kind']>>

/**
 * A token of the stream, where it is, and whether a newline stands between
 * it and the token before it — the one fact about the trivia between them
 * a rule reads, the trivia itself being left out of the stream: JavaScript
 * ends a statement written without its `;` at a newline, so the parser
 * asks it of the token after such a statement
 * ([spec: module structure](../../../spec/README.md#module-structure)),
 * and forbids one before `=>` and after `return`, so it asks it there too.
 * A token after leading trivia carries the newline that trivia holds, the
 * stream's first token included.
 */
export type DjsTokenWithMetadata = {
    readonly token: DjsToken
    readonly metadata: TokenMetadata
    readonly newline: boolean
}
