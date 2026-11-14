import { denoSteps } from './module.f.js'
import { deno } from '../config/module.f.js'
import { environmentCommand } from '../environment/module.f.js'
import { toSteps } from '../common/module.f.js'
import { assertStructurallySame } from '../../asserts/module.f.js'
export const proof = {
    commands: () => assertStructurallySame(toSteps(denoSteps).flatMap(step => step.run === undefined ? [] : [step.run]), [
        `test "$(${environmentCommand("deno eval 'console.log(Deno.version.deno)'")})" = "${deno}"`,
        environmentCommand('deno install --frozen'),
        environmentCommand('deno test -A ./fjs/emergent_testing/fjs-only.mjs'),
    ]),
}
