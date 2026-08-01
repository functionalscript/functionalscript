/**
 * CI job that installs Playwright (with a browser-cache step) and runs the
 * test suite against Chromium, Firefox, and WebKit.
 *
 * @module
 */
import { images, node, playwright } from '../config/module.f.ts'
import { type Job, type MetaStep, install, test, toSteps, uses } from '../common/module.f.ts'
import { basicNode, major, nixSystem } from '../node/module.f.ts'
import { nixVersionCheckStep, type NixJob } from '../nix/module.f.ts'

const playwrightImage = images.ubuntu.arm

/**
 * The Playwright job's generated flake pins the same Node it currently gets
 * from `setup-node`. It deliberately stops there: the browsers Playwright
 * installs must match the exact `@playwright/test` version pinned in
 * `package.json`, and the Nixpkgs snapshot pinned in `../config/module.f.ts`
 * does not carry that version — see the Related TODO for the experiment that
 * found this. Syncing Nixpkgs-provided browsers with Playwright's own
 * versioning is out of scope here.
 */
export const playwrightNixJob: NixJob = {
    id: 'playwright',
    system: nixSystem,
    packages: [`nodejs_${major(node.default)}`],
}

/** Version-check step for the Playwright job's generated flake. */
export const playwrightNixVersionStep: MetaStep =
    nixVersionCheckStep(playwrightNixJob.id, node.default)

export const playwrightJob: Job = {
    'runs-on': playwrightImage,
    steps: toSteps(basicNode(node.default)([
        install(uses('actions/cache', {
            path: '~/.cache/ms-playwright',
            key: `${playwrightImage}-playwright-${playwright}`,
        })),
        install({ run: `npm install -g playwright@${playwright}` }),
        install({ run: 'playwright install-deps' }),
        install({ run: 'playwright install' }),
        // we have to use `npx` to make sure that we respect `@playwright/test` version from
        // the `package.json`.
        ...['chromium', 'firefox', 'webkit'].map(browser =>
            test({ run: `npx playwright test --browser=${browser}` })),
    ]))
}
