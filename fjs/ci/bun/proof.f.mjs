import { bunSteps } from './module.f.mjs'
import { bun } from '../config/module.f.js'
import { environmentCommand } from '../environment/module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { assertStructurallySame } from '../../asserts/module.f.js'
export const proof = {
    commands: () => assertStructurallySame(toSteps(bunSteps).flatMap(step => step.run === undefined ? [] : [step.run]), [
        `test "$(${environmentCommand('bun --version')})" = "${bun}"`,
        environmentCommand('bun install --frozen-lockfile'),
        environmentCommand('bun test --coverage'),
    ]),
}
