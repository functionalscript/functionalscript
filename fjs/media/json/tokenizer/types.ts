/**
 * Types for the JSON tokenizer.
 *
 * Every declaration here is JSON's own. The tokenizer scans
 * [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)'s lexical grammar
 * directly, so nothing in this file comes from `fjs/js/tokenizer`: a format
 * frozen by its specification does not sit downstream of a lexer that must
 * grow with FunctionalScript.
 *
 * @module
 */

import type { U16 } from '../../../text/utf16/types.ts'

export type StringToken = {
    readonly kind: 'string'
    /** The literal's **decoded** value: escapes resolved, quotes removed. */
    readonly value: string
}

/**
 * A numeric literal, kept as the exact source lexeme.
 *
 * `value` is the canonical lossless numeric source: the tokenizer never
 * narrows it to a runtime numeric representation, so a syntactically valid
 * literal reaches its consumer whatever its magnitude — a coefficient beyond
 * the runtime's `bigint` limit and an exponent beyond `number` precision
 * alike. Each consumer applies its own numeric policy to `value`; see
 * [`fjs/media/json/number`](../number/module.f.mjs) for the bounded lexical
 * helpers that read it without narrowing.
 */
export type NumberToken = {
    readonly kind: 'number'
    readonly value: string
}

/**
 * The tokenizer's whole error vocabulary — four messages, one per lexeme kind
 * that can fail, plus the one for a character that starts no lexeme at all.
 *
 * It is a closed union rather than `string` so a consumer can switch on it
 * exhaustively, and so a message JSON cannot produce does not typecheck. The
 * ten-message union this replaces was the JavaScript tokenizer's: JSON emitted
 * nine of them, `*\/ expected` included, which is JSON being told about an
 * unterminated comment it has no comments to have.
 */
export type JsonErrorMessage =
    'invalid number' |
    'invalid string' |
    'invalid token' |
    'unexpected character'

export type ErrorToken = {
    readonly kind: 'error'
    readonly message: JsonErrorMessage
}

export type EofToken = { readonly kind: 'eof' }

export type JsonToken = |
    {readonly kind: 'true' | 'false' | 'null' } |
    {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' } |
    StringToken |
    NumberToken |
    ErrorToken |
    EofToken

/**
 * What one character did to a scan.
 *
 * `consumed` took the character into the lexeme. `stopped` did **not**: the
 * caller still holds it, and decides whether it terminates the lexeme, is
 * re-dispatched as the start of the next one, or is taken over by a wrapper
 * scanning a larger grammar. That distinction is the seam
 * [`fjs/media/datajs`](../../datajs/) reuses, which is why it is a return type
 * rather than a convention.
 */
export type ScanResult<S> =
    { readonly kind: 'consumed', readonly state: S } |
    { readonly kind: 'stopped', readonly state: S }

/**
 * A scanner: one state, one character, one result. `input` is `null` at end of
 * input, so a scanner needs no separate finish call and a caller's terminator
 * policy handles the end as one more non-continuing character.
 *
 * A scanner emits **no tokens** — it advances a state that carries the lexeme,
 * and building a token from it is the caller's, which is what lets JSON build
 * one and DataJS build a different one from the same scan.
 */
export type Scan<S> = (state: S) => (input: U16 | null) => ScanResult<S>

/**
 * `scanNumber`'s state: the grammar's seven phases, plus `start` and
 * `recovery`.
 *
 * The union is **public and discriminated** on purpose. A wrapper scanning a
 * larger grammar has to reach into the middle of a JSON number — `1n`'s bigint
 * is JSON's `int` followed by `n`, and `-Infinity` diverges right after the
 * sign — and it has to do so *before* the accept-or-reject decision. An opaque
 * state would make both impossible.
 *
 * Which variant a wrapper may claim is therefore part of the contract:
 *
 * - `int` is the bigint interception point, and is reachable only by a
 *   well-formed integer part. That is what makes `00n` inexpressible, which
 *   matters as much as making `12n` expressible: JavaScript rejects `00n`
 *   exactly as it rejects `00`, and a `00` has already absorbed its second
 *   digit into `recovery`.
 * - `sign` is the `-Infinity` interception point, and only it.
 * - `start` is **closed**: it says nothing has been read, so treating it as
 *   `sign` or `int` would let an untouched scan pose as an interception site.
 * - `recovery` is **closed**, and terminal — see the scanner's own doc.
 *
 * `lexeme` is the exact source text consumed so far, empty in `start`. It is a
 * `string` rather than the `readonly U16[]` the design specified: a JavaScript
 * string *is* a sequence of UTF-16 code units, and it is the one accumulator
 * whose append does not copy. Measured at the size
 * [`proof.f.mjs`](./proof.f.mjs)'s losslessness cases already use — a
 * 100,002-character lexeme — the array costs 15,946ms against the string's
 * 5ms, so the specified shape would have added about a minute to the suite for
 * no gain at the seam: stage 4 reads `kind` to intercept and `lexeme` to build
 * a value, and `BigInt(lexeme)` wants the string either way.
 */
export type NumberState = {
    readonly kind:
        'start' | 'sign' | 'int' | 'point' | 'frac' |
        'exp' | 'expSign' | 'expDigits' | 'recovery'
    readonly lexeme: string
}

/**
 * `scanString`'s state.
 *
 * `recovery` carries **no value**, which is the point of it being its own
 * variant: a malformed literal has no value to report, so a variant with
 * nowhere to put one cannot produce a token for text the document never
 * contained. The defect is unrepresentable rather than merely forbidden.
 *
 * `recoveryEscape` is required because recovery keeps interpreting
 * backslashes — it scans for the end of the *literal*, not for the next quote
 * character — so `"\x\""` is one error rather than two.
 *
 * `hex`'s `digits` are the `0..15` **values** decoded so far, not the
 * characters: every entry passed `hexDigitValue` before being stored, so
 * folding them into a code unit needs no failure case and therefore no
 * unreachable branch.
 *
 * `done` and `failed` are terminal: every input returns `stopped` and consumes
 * nothing, so a caller that keeps feeding them gets a stable answer.
 *
 * Values are `string` rather than `readonly U16[]` for the reason
 * {@link NumberState} gives. A JSON string simply *is* a sequence of code
 * units — `"\ud800"` is a lone surrogate JSON permits and no code point can
 * represent, and `"😀"` must decode to the same two units as its escaped
 * spelling — so the scanner never decodes beyond resolving escapes.
 */
export type StringState =
    { readonly kind: 'start' } |
    { readonly kind: 'body' | 'escape', readonly value: string } |
    { readonly kind: 'hex', readonly value: string, readonly digits: readonly number[] } |
    { readonly kind: 'recovery' | 'recoveryEscape' } |
    { readonly kind: 'done', readonly value: string } |
    { readonly kind: 'failed' }

/**
 * The tokenizer's own state: which lexeme it is in the middle of.
 *
 * `numberRecovery` has no scanner state because `scanNumber`'s `recovery` is
 * terminal — recovery ends at a *boundary*, and the boundary set is the
 * caller's, so the tokenizer runs it.
 *
 * @internal
 */
export type _TokenizerState =
    { readonly kind: 'top' } |
    { readonly kind: 'string', readonly string: StringState } |
    { readonly kind: 'number', readonly number: NumberState } |
    { readonly kind: 'numberRecovery' } |
    { readonly kind: 'word', readonly lexeme: string }
