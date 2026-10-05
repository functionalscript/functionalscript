/**
 * Proofs for the generated-Rust writer.
 */

import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { step } from '../../module.f.mjs'
import { exitCode, readUtf8File } from '../../node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../../node/virtual/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { generate } from '../rust/module.f.mjs'
import { generateOperations, main, path } from './module.f.mjs'

export const proof = {
    /** The directory is made, and the file reads back as it was printed. */
    generateOperations: () => {
        const [, [tag, result]] = virtual(emptyState)(step(generateOperations(), () => readUtf8File(path)))
        assert(tag === 'ok', result)
        assertEq(result, unwrap(generate()))
    },
    main: () => {
        const [, result] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 0)
    },
}
