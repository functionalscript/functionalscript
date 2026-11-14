import { spiderMonkeySteps } from './module.f.js'
import { spidermonkey } from '../config/module.f.js'
import { environmentCommand } from '../environment/module.f.js'
import { toSteps } from '../common/module.f.js'
import { assertStructurallySame } from '../../asserts/module.f.js'

export const proof = {
    checks: () => {
        assertStructurallySame(
            toSteps(spiderMonkeySteps).flatMap(step => step.run === undefined ? [] : [step.run]),
            [
                `test "$(${environmentCommand('js --version')})" = "JavaScript-C${spidermonkey.version}"`,
                environmentCommand('npm run sm c'),
                environmentCommand('npm run sm t'),
            ])
    },
}
