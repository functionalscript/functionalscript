/**
 * Proofs for the generated-Rust writer.
 *
 * @module
 */

import { exitCode } from '../../effects/node/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import {
    defaultNodeProgramOptions,
    emptyState,
    virtual,
} from '../../effects/node/virtual/module.f.mjs'
import { data } from '../module.f.mjs'
import { generate, path } from '../rust/module.f.mjs'
import { generateRustTests, main } from './module.f.mjs'

export const proof = {
    generateRustTests: () => {
        // The target directory does not exist in `emptyState`, so this also
        // covers the `mkdir` the writer does before the file write.
        const written = ioStep(generateRustTests(), () => readUtf8File(path))
        const [, [tag, result]] = virtual(emptyState)(written)
        assert(tag === 'ok', result)
        assertEq(result, generate(data))
    },
    main: () => {
        const [, result] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 0)
    },
}
