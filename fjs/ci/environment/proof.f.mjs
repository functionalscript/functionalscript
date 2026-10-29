import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { commandPrefix, environmentCommand, environmentSteps, environmentVersionStep } from './module.f.mjs'
export const proof = {
    commands: () => {
        assertEq(commandPrefix, 'env ')
        assertEq(environmentCommand('node --version'), 'env node --version')
        assertStructurallySame(environmentSteps(['npm ci']), [{ type: 'test', step: { run: 'env npm ci' } }])
        assertStructurallySame(environmentVersionStep('node --version', 'v26.13.0'), { type: 'test', step: { run: 'test "$(env node --version)" = "v26.13.0"' } })
    },
}
