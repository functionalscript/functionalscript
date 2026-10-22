/**
 * Host proof of the calls the samples list states: each function sample,
 * imported, answers each input as the list says JavaScript does. The
 * generated Rust tests (`gen.samples/mod.rs`) hold the compiled samples to
 * the same answers, so the two runs a page compares are both tested.
 *
 * It also holds each spec page's README to the demo it introduces: the
 * README shows the module the demo runs, as one of its code blocks, and
 * names each input Run calls it with.
 *
 * A host proof, since a FunctionalScript proof cannot catch a throw, and
 * half the point of the comma's example is the call that throws; nor read
 * a file.
 *
 * @module
 *
 * @import { Outcome } from '../page/types.ts'
 */

import { readFileSync } from 'node:fs'
import { assert, assertEq } from '../../../asserts/module.f.js'
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

/** A file of the repository, as text. @type {(path: string) => string} */
const read = path => readFileSync(new URL(`${root}${path}`, import.meta.url), 'utf8')

/**
 * Code with its JSDoc comments, types included, taken out and its
 * whitespace collapsed: what a README's block and the sample share.
 *
 * @type {(code: string) => string}
 */
const bare = code => code.replace(/\/\*\*[\s\S]*?\*\/\s*/g, '').replace(/\s+/g, ' ').trim()

/** The `js` code blocks of a README. @type {(text: string) => readonly string[]} */
const blocks = text => [...text.matchAll(/```js\n([\s\S]*?)```/g)].map(m => m[1])

export const proof = Object.fromEntries(samples.flatMap(place => 'calls' in place ? [[place.name, {
    calls: async () => {
        const { default: entry } = await import(`${root}${place.directory}/sample.f.js`)
        for (const [input, expected] of place.calls) {
            assertEq(outcome(entry, input).join(' '), expected.join(' '))
        }
    },
    readme: () => {
        const readme = read(`${place.directory}/README.md`)
        const sample = bare(read(`${place.directory}/sample.f.js`))
        assert(blocks(readme).some(block => bare(block) === sample), `${place.directory}/README.md does not show sample.f.js`)
        for (const [input] of place.calls) {
            assert(readme.includes(`\`${input}\``), `${place.directory}/README.md does not name the input ${input}`)
        }
    },
}]] : []))
