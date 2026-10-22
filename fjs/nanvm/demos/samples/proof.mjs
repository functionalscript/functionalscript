/**
 * Host proof of the calls the samples list states: each function sample,
 * imported, answers each input as the list says JavaScript does. The
 * generated Rust tests (`gen.samples/mod.rs`) hold the compiled samples to
 * the same answers, so the two runs a page compares are both tested.
 *
 * A host proof, since a FunctionalScript proof cannot catch a throw, and
 * half the point of the comma's example is the call that throws.
 *
 * @module
 *
 * @import { Outcome } from '../page/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.js'
import { spell } from '../spell/module.f.mjs'
import { samples } from './module.f.mjs'

/** The repository's root, from this directory. */
const root = '../../../../'

/** @type {(entry: (input: number) => unknown, input: number) => Outcome} */
const outcome = (entry, input) => {
    try {
        return ['returned', spell(entry(input))]
    } catch (e) {
        return ['threw', spell(e)]
    }
}

export const proof = Object.fromEntries(samples.flatMap(place => 'calls' in place ? [[place.name, async () => {
    const { default: entry } = await import(`${root}${place.directory}/sample.f.js`)
    for (const [input, expected] of place.calls) {
        assertEq(outcome(entry, input).join(' '), expected.join(' '))
    }
}]] : []))
