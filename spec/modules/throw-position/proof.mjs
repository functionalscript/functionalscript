/**
 * Host proof of the page's files ([`hostProof`](../../../fjs/compiler/refused_demo/host.mjs)):
 * `sample.mjs` is no FunctionalScript, so no FunctionalScript module imports
 * it; this host proof does. Importing it throws, so it is imported here
 * dynamically, and the answer is what the import threw.
 *
 * @module
 */

import { hostProof } from '../../../fjs/compiler/refused_demo/host.mjs'
import * as page from './demo.f.mjs'

/** What importing the sample answers: its default export, or what it threw. */
const value = await import('./sample.mjs').then(
    module => module.default,
    thrown => `none: importing it throws ${thrown}`)

export const proof = hostProof(import.meta.url, value, page)
