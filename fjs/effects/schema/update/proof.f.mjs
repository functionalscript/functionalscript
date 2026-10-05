/**
 * Proofs for the generated-Rust writer.
 */

import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { step } from '../../module.f.mjs'
import { exitCode, readUtf8File } from '../../node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../../node/virtual/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { generate } from '../rust/module.f.mjs'
import { generate as generateDispatch } from '../rust/dispatch/module.f.mjs'
import { dispatchPath, generateOperations, main, path } from './module.f.mjs'

export const proof = {
    /** The directory is made, and each file reads back as it was printed. */
    generateOperations: () => {
        const [, [tag, result]] = virtual(emptyState)(step(generateOperations(), () => readUtf8File(path)))
        assert(tag === 'ok', result)
        assertEq(result, unwrap(generate()))
        const [, [dispatchTag, dispatched]] = virtual(emptyState)(step(generateOperations(), () => readUtf8File(dispatchPath)))
        assert(dispatchTag === 'ok', dispatched)
        assertEq(dispatched, unwrap(generateDispatch()))
    },
    main: () => {
        const [, result] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 0)
    },
}
