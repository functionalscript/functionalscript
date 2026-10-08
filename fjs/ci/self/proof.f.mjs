/**
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 */

import { main, packageConsumer } from './module.f.mjs'
import { ci, main as builtIn } from '../module.f.mjs'
import { exitCode } from '../../effects/node/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/**
 * The `gen.ci.yml` a program writes over an empty project — no `Cargo.toml`, no
 * `package.json`, not even the workflows directory: the generator creates it.
 *
 * @type {(program: Effect<NodeOp, 0, number>) => string}
 */
const workflowOf = program => {
    /** @type {Dir} */
    const root = {}
    const [state, code] = virtual({ ...emptyState, root })(program)
    assertEq(exitCode(code), 0, state.stderr)
    const github = state.root['.github']
    assert(typeof github === 'object' && !(github instanceof Array), github)
    const workflows = github['workflows']
    assert(typeof workflows === 'object' && !(workflows instanceof Array), workflows)
    const file = workflows['gen.ci.yml']
    assert(file instanceof Array && file.length !== 0, file)
    return utf8ToString(file[0])
}

export const proof = {
    // This repository's generation is `ci` with its consumer and its macOS
    // and Windows jobs in the merge queue, and nothing else: the same text, so
    // a change to what `main` passes shows here.
    isCiWithTheConsumer: () => {
        assertEq(
            workflowOf(main()),
            workflowOf(ci({ nodeExtra: () => [], packageConsumer, mergeQueueOnly: ['macos', 'windows'] })))
    },
    // The consumer reaches the workflow, and the built-in command — the one
    // any project runs — carries none: that is the difference between the two
    // entry points, and the reason this module exists.
    namesTheConsumerTheBuiltInDoesNot: () => {
        const own = workflowOf(main())
        assert(own.includes(`packed/${packageConsumer.module}`), 'expected the consumer module imported')
        assert(own.includes(' good.mts'), 'expected the consumer steps')
        const generic = workflowOf(builtIn())
        assert(!generic.includes(' good.mts'), 'expected no consumer step from the built-in command')
        // Nor does it gate a job on the merge queue: a project without one
        // would never run that job.
        assert(own.includes('merge_group\'"'), 'expected a merge-queue-only job')
        assert(!generic.includes('merge_group\'"'), 'expected no merge-queue-only job from the built-in command')
    },
}
