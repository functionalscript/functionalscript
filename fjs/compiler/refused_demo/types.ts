/**
 * The sample of a refused construct's page
 * ([`./module.f.mjs`](./module.f.mjs)).
 *
 * @module
 */

import type { Loaded } from '../../nanvm/demos/page/types.ts'

/**
 * The message a page proposes `fjs compile` print for its sample, in the
 * shape of the one it prints: the error, the refused token marked with a
 * label beside the carets, then what to write instead and where the reason
 * is.
 */
export type Suggestion = {
    /** The error's message, in place of the compiler's. */
    readonly message: string
    /** How many characters the carets cover: the refused token. */
    readonly width: number
    /** What the label beside the carets says of the token. */
    readonly label: string
    /** What FunctionalScript allows instead, as a sentence. */
    readonly help: string
    /** The sample's line, rewritten as the alternative writes it. */
    readonly fix: string
    /** Where the reason for the refusal is. */
    readonly note: string
}

/**
 * A spec page's refused sample: the page's directory, where `sample.mjs`
 * and `alternative.f.js` are; each module's default export, as JavaScript
 * evaluates it; and the message the page proposes for the refusal.
 */
export type RefusedSample = {
    readonly directory: string
    readonly entry: unknown
    readonly alternative: unknown
    readonly suggestion: Suggestion
}

/** The texts of the sample and its alternative, once fetched. */
export type State = {
    readonly source: Loaded<string>
    readonly alternative: Loaded<string>
}
