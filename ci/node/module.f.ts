import { node, playwright } from '../config/module.f.ts'
import { type Job, type Jobs, type MetaStep, type Os, clean, install, test, ubuntu } from '../common/module.f.ts'

export const major = (v: string) => v.split('.')[0]

const installNode = (version: string) =>
    ({ uses: 'actions/setup-node@v6', with: { 'node-version': version } })

const basicNode = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => clean([
    install(installNode(version)),
    test({ run: 'npm ci' }),
    ...extra,
])

export const nodeTests = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => basicNode(version)([
    test({ run: 'npm test' }),
    test({ run: 'npm run fst' }),
    ...extra,
])

const findTgz = (v: Os) => v === 'windows' ? '(Get-ChildItem *.tgz).FullName' : './*.tgz'

const playwrightAndVersion = `playwright@${playwright}`

const nodeTest = (v: string) => major(v) === '20' ? 'run test20' : 'test'

const nodeSteps = (v: string) => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
    test({ run: `npm ${nodeTest(v)}`}),
]

export const nodeVersions: Jobs = Object.fromEntries(node.others.map(v => [
    `node${major(v)}`,
    ubuntu(nodeSteps(v))
]))

// Playwright installation is stuck on Node 26 (May 7 2026) so we use Node 24.
export const playwrightJob: Job = ubuntu(basicNode(node.others.at(-1)!)([
    install({ run: `npm install -g ${playwrightAndVersion}` }),
    install({ run: 'playwright install --with-deps' }),
    // we have to use `npx` to make sure that we respect `@playwright/test` version from
    // the `package.json`.
    ...['chromium', 'firefox', 'webkit'].map(browser =>
        test({ run: `npx playwright test --browser=${browser}` })),
]))

export const nodeMainSteps = (v: Os): readonly MetaStep[] => nodeTests(node.default)([
    // TypeScript Preview
    install({ run: 'npm install -g @typescript/native-preview'}),
    test({ run: 'tsgo' }),
    // publishing
    test({ run: 'npm pack' }),
    test({ run: `npm install -g ${findTgz(v)}` }),
    test({ run: 'fjs compile issues/demo/data/tree.json _tree.f.js' }),
    test({ run: 'fjs t' }),
    test({ run: 'npm uninstall functionalscript -g' }),
])
