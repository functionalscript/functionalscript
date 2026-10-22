/**
 * Host proof of the page's JavaScript answer. `sample.mjs` is no
 * FunctionalScript, so no FunctionalScript module imports it; this host proof
 * does, and holds the answer [`demo.f.mjs`](./demo.f.mjs) states to the
 * sample's default export.
 *
 * @module
 */

import { assertEq } from '../../../../fjs/asserts/module.f.js'
import sample from './sample.mjs'
import { answer } from './demo.f.mjs'

export const proof = {
    answer: () => assertEq(String(sample), answer),
}
