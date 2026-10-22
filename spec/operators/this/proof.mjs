/**
 * Host proof of the page's files ([`hostProof`](../../../fjs/compiler/refused_demo/host.mjs)):
 * `sample.mjs` is no FunctionalScript, so no FunctionalScript module imports
 * it; this host proof does. Bun gives a module's `this` an object, where
 * the standard gives `undefined` (README.md).
 *
 * @module
 */

import { hostProof } from '../../../fjs/compiler/refused_demo/host.mjs'
import sample from './sample.mjs'
import * as page from './demo.f.mjs'

export const proof = hostProof(import.meta.url, sample, page, ['object'])
