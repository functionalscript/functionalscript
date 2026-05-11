import { images, node, playwright } from '../config/module.f.ts'
import { type Job, install, test, toSteps } from '../common/module.f.ts'
import { basicNode } from '../node/module.f.ts'

const playwrightImage = images.ubuntu.intel

// Playwright installation is stuck on Node 26 (May 7 2026) so we use Node 24.
export const playwrightJob: Job = {
    'runs-on': playwrightImage,
    steps: toSteps(basicNode(node.others.at(-1)!)([
        install({
            uses: 'actions/cache@v4',
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
