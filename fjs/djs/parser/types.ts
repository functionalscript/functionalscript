/**
 * Type-level API for `fjs/djs/parser/module.f.mjs`: the `ParseError` shape
 * `parseFromTokens` reports, the `_ValueToken` subset `tokenToValue` accepts,
 * and the parser layer's token alphabet.
 *
 * @module
 */

import type { TokenMetadata, TokenPosition } from '../../js/tokenizer/types.ts'
import type { DjsToken } from '../tokenizer/types.ts'

/**
 * A parse failure and where it is.
 *
 * `metadata` is the anchor — the position a reader is pointed at, `null` when
 * there is no token to point at (an empty stream, or a `.json` input read by a
 * reader that tracks no positions).
 *
 * `end` extends that anchor into a span, and is present only when the failure
 * came with one. A lexical error passes through the `end` its token carried, so
 * an unterminated string spans its opening quote to where the input ran out. A
 * *grammar* failure has no span: it points at one token, and a token's extent is
 * not recorded — see `ErrorToken` in `fjs/js/tokenizer/types.ts`, and the
 * `error-position-range` todo for the widening that would give every token one.
 */
export type ParseError = {
    readonly message: string,
    readonly metadata: TokenMetadata | null
    readonly end?: TokenPosition | undefined
}

/**
 * The words that frame a module, which the grammar has to tell apart from an
 * ordinary identifier.
 *
 * The tokenizer emits all five as `{ kind: 'id' }` with the word in `value`, so
 * a parser layer keyed on `kind` alone would give them the same symbol as any
 * other identifier — and a grammar over that alphabet could not distinguish
 * `export default` from two arbitrary names. They therefore get terminals of
 * their own, which is what a registered alphabet allows: a name's symbol comes
 * from its position in the list, so a name has no length limit.
 *
 * This is the same distinction the hand-written parser makes by comparing
 * `token.value`, lifted from control flow into the alphabet.
 */
export type _FramingKeyword = 'import' | 'const' | 'export' | 'default' | 'from'

/**
 * A token name the parser layer's grammar can name as a terminal: every
 * `DjsToken` kind except `eof`, plus the framing keywords.
 *
 * `eof` is excluded because a BNF backend synthesizes its own logical
 * end-of-input; the tokenizer's physical `eof` token is split off the stream
 * before any name is mapped, so it never reaches this alphabet.
 *
 * The kinds are derived from `DjsToken` rather than listed, so a token kind
 * added there cannot silently go unrepresented at the parser layer.
 */
export type _OrdinaryTokenName = Exclude<DjsToken['kind'], 'eof'> | _FramingKeyword

/** DJS tokens that carry a directly-usable value. */
export type _ValueToken = Extract<DjsToken, {
    readonly kind: 'null' | 'false' | 'true' | 'undefined' | 'string' | 'number' | 'bigint'
}>
