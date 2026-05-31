/**
 * CI job that installs Playwright (with a browser-cache step) and runs the
 * test suite against Chromium, Firefox, and WebKit.
 *
 * @module
 */
import { ghActions, images, node, playwright } from '../config/module.f.ts'
import { type Job, install, test, toSteps } from '../common/module.f.ts'
import { basicNode } from '../node/module.f.ts'

const playwrightImage = images.ubuntu.intel

export const playwrightJob: Job = {
    'runs-on': playwrightImage,
    steps: toSteps(basicNode(node.default)([
        install({
            uses: ghActions.cache,
            with: {
                path: '~/.cache/ms-playwright',
                key: `${playwrightImage}-playwright-${playwright}`,
            },
        }),
        install({ run: `npm install -g playwright@${playwright}` }),
        install({ run: 'playwright install-deps' }),
        install({ run: 'playwright install' }),
        // we have to use `npx` to make sure that we respect `@playwright/test` version from
        // the `package.json`.
        ...['chromium', 'firefox', 'webkit'].map(browser =>
            test({ run: `npx playwright test --browser=${browser}` })),
    ]))
}
