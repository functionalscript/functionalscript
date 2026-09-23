/**
 * Type-level API for `fjs/fsc/parser/module.f.mjs`: the `ParseError` shape
 * `parseFromTokens` reports. The nodes the rewrite set builds and the
 * alphabet it returns them in are the reader's, in `./reader/types.ts`;
 * the input alphabet is the grammar's, in `./grammar/types.ts`.
 *
 * @module
 */

import type { TokenMetadata, TokenPosition } from '../../ebnf/lib/js/types.ts'

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
 * not recorded — see `ErrorToken` in `fjs/ebnf/lib/js/types.ts`, and
 * `../parser/README.md` for the widening that would give every token one.
 */
export type ParseError = {
    readonly message: string,
    readonly metadata: TokenMetadata | null
    readonly end?: TokenPosition | undefined
    /**
     * The file a failure with no token is in, when the failure knows one: a
     * missing file, a cycle, a body that fails to evaluate — each in an
     * imported module as readily as in the one being compiled, which
     * `metadata: null` alone would name.
     */
    readonly path?: string | undefined
}
