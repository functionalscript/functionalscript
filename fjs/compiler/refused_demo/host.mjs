/**
 * The host proof of a refused construct's page
 * ([`./module.f.mjs`](./module.f.mjs)), one for every page: each page's
 * `proof.mjs` is the call of {@link hostProof} with its own files.
 *
 * **The page's files are read, not copied.** A page states its sample's
 * text in `demo.f.mjs`, where its FunctionalScript proof pins what
 * `fjs compile` prints for it. That statement is one more copy of
 * `sample.mjs`, so this proof holds it to the file, and holds the README to
 * show the same module and the proposed message's fix to be the line
 * `alternative.f.js` writes; and, for a page whose sample imports, its
 * `a.f.js` to be the module the page compiles beside the sample. An edit to
 * any one of them that the others do not follow fails here, not on the
 * deployed page.
 *
 * A host module, since FunctionalScript reads no files and imports no
 * plain `.mjs`: the sample is one, valid JavaScript the compiler refuses.
 *
 * @module
 *
 * @import { Suggestion } from './types.ts'
 */

import { existsSync, readFileSync } from 'node:fs'
import { assert, assertEq } from '../../asserts/module.f.js'
import { alternativeName, dependency, dependencyName, sampleName } from './module.f.mjs'

/**
 * The file `name` beside the module at `url`, as text.
 *
 * @type {(url: string) => (name: string) => string}
 */
const read = url => name => readFileSync(new URL(name, url), 'utf8')

/**
 * The proof of the page whose `proof.mjs` is at `url`: what JavaScript
 * answers for the sample, its default export `value`, as `demo.f.mjs`
 * states it, or as one of `hosts` answers it where an engine departs from
 * the standard; the sample's text, as `demo.f.mjs` states it, in
 * `sample.mjs` and in the README; and the fix, in the alternative.
 *
 * @type {(url: string, value: unknown, page: { readonly answer: string, readonly sample: string, readonly suggestion: Suggestion }, hosts?: readonly string[]) => Record<string, () => void>}
 */
export const hostProof = (url, value, { answer, sample: text, suggestion }, hosts = []) => {
    const file = read(url)
    return {
        answer: () => assert(String(value) === answer || hosts.includes(String(value)), String(value)),
        sample: () => assertEq(file(sampleName), text),
        readme: () => assert(file('README.md').includes(text.trimEnd()), 'the README does not show sample.mjs'),
        fix: () => assert(file(alternativeName).includes(suggestion.fix), 'the suggested fix is not a line of alternative.f.js'),
        dependency: () => assert(!existsSync(new URL(dependencyName, url)) || file(dependencyName) === dependency, 'a.f.js is not the module the page compiles beside the sample'),
    }
}
