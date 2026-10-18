import { shellSpiderMonkeyCommands, shellSpiderMonkeyVersionSteps } from './module.f.mjs'
import { spidermonkey } from '../config/module.f.js'
import { nixDevelop } from '../nix/module.f.mjs'
import { _runs } from '../nix/testlib.f.mjs'
import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

export const proof = {
    // ARM Linux asserts the shell's whole version, then runs the commands a
    // developer runs: the compile check, then the suite.
    ubuntuArm: () => {
        assertStructurallySame(
            _runs(shellSpiderMonkeyVersionSteps('ubuntu', 'arm')),
            [`test "$(${nixDevelop('js --version')})" = "JavaScript-C${spidermonkey.version}"`])
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
