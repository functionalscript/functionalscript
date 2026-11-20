/**
 * The self-compile check's steps: a directory outside the checkout, the
 * compiler written by the checkout and then by what that wrote, and the two
 * writes compared, in that order.
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { compare, prepare, selfCompileSteps, writes } from './module.f.js'

export const proof = /** @type {const} */ ({
    steps: () => {
        assertStructurallySame(selfCompileSteps.map(step => [step.type, step.type === 'rust' ? undefined : step.step.run]), [
            ['test', prepare],
            ['test', `env ${writes[0]}`],
            ['test', `env ${writes[1]}`],
            ['test', compare],
        ])
    },
    // the second write is by the first one, run as the compiler, and both
    // are of the same input; the comparison is of those two files
    commands: () => {
        assertEq(prepare, 'mkdir "$RUNNER_TEMP/self"')
        assertStructurallySame(writes, [
            'npm start c ./fjs/module.f.js "$RUNNER_TEMP/self"/first.f.js',
            'npm start r "$RUNNER_TEMP/self"/first.f.js c ./fjs/module.f.js "$RUNNER_TEMP/self"/second.f.js',
        ])
        assertEq(compare, 'git diff --no-index --exit-code --stat "$RUNNER_TEMP/self"/first.f.js "$RUNNER_TEMP/self"/second.f.js')
    },
})
