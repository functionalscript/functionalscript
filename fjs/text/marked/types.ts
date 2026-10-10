/**
 * Type-level API of `fjs/text/marked`: a text written as runs, each with the
 * kind the producer knew it to be.
 *
 * @module
 */

/**
 * What a run of text is. The names are LSP's standard token types, plus
 * `literal` for `true`, `false`, `null` and `undefined`, which LSP has no
 * type for, and `identifier` for a name whatever it names: LSP has only the
 * refinements — `variable`, `property`, `function`, `type`, … — which a
 * producer that knows which a name is can use beside it, additively. A kind
 * states what the producer wrote, never how it looks.
 */
export type TokenKind = 'keyword' | 'literal' | 'string' | 'number' | 'comment' | 'operator' | 'identifier'

/** A run of text and, when it has one, its kind. */
export type Run = readonly [text: string, kind?: TokenKind]

/** A text written as runs. The runs' texts, concatenated, are the text. */
export type Marked = readonly Run[]

/**
 * A kind of `length` code points from `start`, beside a text that already
 * exists. The offsets are code points, as the tokenizer's positions are.
 */
export type Span = {
    readonly start: number
    readonly length: number
    readonly kind: TokenKind
}

/**
 * A piece of text on its way to becoming {@link Marked}: a bare string is an
 * unmarked run. It lets a writer migrate piece by piece, the pieces it has
 * not marked yet staying strings.
 */
export type Chunk = string | Run
