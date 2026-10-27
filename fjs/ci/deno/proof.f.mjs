import { denoSteps } from './module.f.mjs'
import { deno } from '../config/module.f.js'
import { environmentCommand } from '../environment/module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { assertStructurallySame } from '../../asserts/module.f.js'
export const proof = {
    commands: () => assertStructurallySame(toSteps(denoSteps).flatMap(step => step.run === undefined ? [] : [step.run]), [
        `test "$(${environmentCommand("deno eval 'console.log(Deno.version.deno)'")})" = "${deno}"`,
        environmentCommand('deno install --frozen'),
        environmentCommand('deno test -A ./fjs/emergent_testing/fjs-only.mjs'),
    ]),
}
