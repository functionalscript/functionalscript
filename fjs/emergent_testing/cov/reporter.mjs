/**
 * Native coverage admission before the existing quiet reporter filters output.
 * Filesystem discovery and process exit status stay at this host boundary.
 *
 * @module
 *
 * @import { _Event } from './types.ts'
 */

import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

import quiet from '../node/module.mjs'
import { _coverageFailures, isCoverageTarget } from './module.f.mjs'

/** @type {(source: AsyncIterable<_Event>) => AsyncGenerator<string>} */
export default async function* (source) {
    const expected = readdirSync(process.cwd(), { withFileTypes: true })
        .filter(file => !file.isDirectory() && isCoverageTarget(file.name))
        .map(file => resolve(file.name))
    let received = false
    let failed = false
    /** @type {(source: AsyncIterable<_Event>) => AsyncGenerator<_Event>} */
    const checked = async function* (source) {
        for await (const event of source) {
            if (event.type === 'test:coverage') {
                received = true
                for (const message of _coverageFailures(expected, event.data.summary.files)) {
                    process.stderr.write(message + '\n')
                    failed = true
                }
            }
            yield event
        }
    }
    yield* quiet(checked(source))
    if (!received || expected.length === 0) {
        process.stderr.write('Missing module coverage report or targets\n')
        failed = true
    }
    if (failed) {
        process.exitCode = 1
    }
}
