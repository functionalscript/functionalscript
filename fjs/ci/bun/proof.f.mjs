import { bunSteps } from './module.f.js'
import { bun } from '../config/module.f.js'
import { environmentCommand } from '../environment/module.f.js'
import { toSteps } from '../common/module.f.js'
import { assertStructurallySame } from '../../asserts/module.f.js'
export const proof = {
    commands: () => assertStructurallySame(toSteps(bunSteps).flatMap(step => step.run === undefined ? [] : [step.run]), [
        `test "$(${environmentCommand('bun --version')})" = "${bun}"`,
        environmentCommand('bun install --frozen-lockfile'),
        environmentCommand('bun test --timeout 30000 ./fjs/emergent_testing/fjs-only.mjs'),
    ]),
}
