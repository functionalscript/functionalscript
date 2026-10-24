/**
 * Host proof of the page's files ([`hostProof`](../../../fjs/compiler/refused_demo/host.mjs)):
 * `sample.mjs` is no FunctionalScript, so no FunctionalScript module imports
 * it; this host proof does. The sample exports no default, so its answer
 * is `undefined`.
 *
 * @module
 */

import { hostProof } from '../../../fjs/compiler/refused_demo/host.mjs'
import * as sample from './sample.mjs'
import * as page from './demo.f.mjs'

export const proof = hostProof(import.meta.url, /** @type {{ readonly default?: unknown }} */ (sample).default, page)
