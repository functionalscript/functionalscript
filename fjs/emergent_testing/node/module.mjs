/**
 * A quiet reporter for `node --test`: Node's `spec` reporter behind the
 * {@link quiet} filter, so a green run prints its summary and nothing per
 * test, and a red one prints what failed.
 *
 * Node loads it by path — `--test-reporter=./fjs/emergent_testing/node/module.mjs`,
 * as `npm run cov` does — calls the default export with the run's event
 * stream, and writes what it yields.
 *
 * @module
 *
 * @import { Event } from './types.ts'
 */

import { spec } from 'node:test/reporters'
import { Readable } from 'node:stream'

import { quiet } from './module.f.mjs'

/** @type {(source: AsyncIterable<Event>) => AsyncGenerator<Event>} */
const kept = async function* (source) {
    for await (const event of source) {
        const k = quiet(event)
        if (k !== null) yield k
    }
}

/**
 * The encoding makes the stream yield strings: without one, a stream's
 * chunks are `Buffer`s, whatever the reporter pushed into it.
 *
 * @type {(source: AsyncIterable<Event>) => AsyncGenerator<string>}
 */
export default async function* (source) {
    yield* Readable.from(kept(source)).pipe(spec()).setEncoding('utf8')
}
