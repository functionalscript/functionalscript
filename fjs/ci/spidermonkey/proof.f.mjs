import { shellSpiderMonkeyCommands, shellSpiderMonkeyVersionSteps } from './module.f.mjs'
import { spidermonkey } from '../config/module.f.js'
import { environmentCommand } from '../environment/module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'

export const proof = {
    // ARM Linux asserts the shell's whole version, then runs the commands a
    // developer runs: the compile check, then the suite.
    ubuntuArm: () => {
        assertStructurallySame(
            toSteps(shellSpiderMonkeyVersionSteps('ubuntu', 'arm')).flatMap(step => step.run === undefined ? [] : [step.run]),
            [`test "$(${environmentCommand('js --version')})" = "JavaScript-C${spidermonkey.version}"`])
        assertStructurallySame(shellSpiderMonkeyCommands('ubuntu', 'arm'), ['npm run sm c', 'npm run sm t'])
    },
    // Every other platform runs nothing for SpiderMonkey: one job is enough,
    // and jobs, not their time, are what CI waits on.
    elsewhere: () => {
        for (const [v, a] of /** @type {const} */ ([
            ['ubuntu', 'intel'],
            ['macos', 'arm'],
            ['macos', 'intel'],
            ['windows', 'arm'],
            ['windows', 'intel'],
        ])) {
            assertEq(shellSpiderMonkeyVersionSteps(v, a).length, 0)
            assertEq(shellSpiderMonkeyCommands(v, a).length, 0)
        }
    },
}
