/**
 * Proofs for the generated-Rust writer.
 *
 * @import { IoChannel, ReadFile } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 */

import { exitCode } from '../../effects/node/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { pureOk, step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import {
    defaultNodeProgramOptions,
    emptyState,
    virtual,
} from '../../effects/node/virtual/module.f.mjs'
import { data } from '../module.f.mjs'
import { directory, generate } from '../rust/module.f.mjs'
import { generate as generateMethods, path as methodsPath } from '../methods/module.f.mjs'
import { generateRustTests, main } from './module.f.mjs'

export const proof = {
    generateRustTests: () => {
        // The target directory does not exist in `emptyState`, so this also
        // covers the `mkdir` the writer does before the file write.
        // Written once, then every file read back as it was printed.
        const files = generate(data)
        /** @type {Effect<ReadFile, readonly string[], IoChannel>} */
        const readAll = files.reduce(
            (/** @type {Effect<ReadFile, readonly string[], IoChannel>} */ e, [name]) =>
                ioStep(e, read => ioStep(readUtf8File(`${directory}/${name}`), c => pureOk([...read, c]))),
            pureOk([]))
        const [, [tag, result]] = virtual(emptyState)(ioStep(generateRustTests(), () => readAll))
        assert(tag === 'ok', result)
        assertEq(result.length, files.length)
        files.forEach(([, content], i) => { assertEq(result[i], content) })
        const table = ioStep(generateRustTests(), () => readUtf8File(methodsPath))
        const [, [tableTag, tableResult]] = virtual(emptyState)(table)
        assert(tableTag === 'ok', tableResult)
        assertEq(tableResult, generateMethods())
    },
    main: () => {
        const [, result] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 0)
    },
}
