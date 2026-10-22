/**
 * The sample of a refused construct's page
 * ([`./module.f.mjs`](./module.f.mjs)).
 *
 * @module
 */

import type { Loaded } from '../../nanvm/demos/page/types.ts'

/**
 * A spec page's refused sample: the page's directory, where `sample.mjs`
 * is, and that module's default export, as JavaScript evaluates it.
 */
export type RefusedSample = {
    readonly directory: string
    readonly entry: unknown
}

/** The sample's text, once fetched. */
export type State = Loaded<string>
