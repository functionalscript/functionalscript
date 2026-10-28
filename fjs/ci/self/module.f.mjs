/**
 * This repository's own CI generation: `ci` with what only this repository
 * can name. `npm run gen` runs it, through `fjs/dev/gen`, where the built-in
 * `fjs ci` — `../module.f.mjs`'s `main` — stays the generator any project
 * gets, since that command cannot know what another package publishes.
 *
 * @module
 *
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { PackageConsumer } from '../types.ts'
 * @import { Job } from '../common/types.ts'
 */

import { ci } from '../module.f.mjs'
import { uses } from '../common/module.f.mjs'
import { images, jobTimeout } from '../config/module.f.js'
import { miseDevelop, miseInstall } from '../mise/module.f.mjs'
import { buildScriptPath } from '../../nanvm/demos/module.f.mjs'
import { rustdocHeadPath, rustdocHeaderPath, rustdocFooterPath, rustdocStylesheetPath } from '../../website/cargo-doc/module.f.mjs'

/** Branch and commit metadata shared by the Rustdoc bars and website pages. */
const buildMetadata = {
    WORKERS_CI_COMMIT_SHA: '${{ github.sha }}',
    WORKERS_CI_BRANCH: '${{ github.head_ref || github.ref_name }}',
}

/**
 * Website assets are built once, independently of the platform matrix. This
 * read-only job runs on the CI workflow's pull-request and merge-group events,
 * including forks, and branch pushes. It runs independently of the test jobs
 * and always builds rather than consulting the check cache,
 * and keeps deployment credentials confined to preview uploads.
 * Production uploads are omitted until cutover. Mise installs the committed lock,
 * including the Rust WASM target; the Cloudflare installer is not needed.
 * @type {Job}
 */
export const websiteJob = {
    'runs-on': images.ubuntu.intel,
    'timeout-minutes': jobTimeout,
    permissions: { contents: 'read' },
    steps: [
        uses('actions/checkout'),
        miseInstall.step,
        { run: miseDevelop('npm ci'), shell: 'bash' },
        { run: miseDevelop(`sh ./${buildScriptPath}`), shell: 'bash' },
        { run: miseDevelop('npm run rustdoc-bars'), shell: 'bash', env: buildMetadata },
        {
            run: miseDevelop('cargo doc --no-deps --workspace'),
            shell: 'bash',
            env: {
                RUSTDOCFLAGS: `--html-in-header ${'${{ github.workspace }}'}/${rustdocHeadPath} --html-before-content ${'${{ github.workspace }}'}/${rustdocHeaderPath} --html-after-content ${'${{ github.workspace }}'}/${rustdocFooterPath} --extend-css ${'${{ github.workspace }}'}/${rustdocStylesheetPath}`,
            },
        },
        {
            run: miseDevelop('npm run website'),
            shell: 'bash',
            env: buildMetadata,
        },
        {
            if: "github.event_name == 'push' && github.ref != 'refs/heads/main'",
            run: miseDevelop('node ./fjs/website/github-deploy.mjs preview'),
            shell: 'bash',
            env: {
                CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
                WORKERS_CI_BRANCH: '${{ github.ref_name }}',
            },
        },
    ],
}

/**
 * What the packed-package check asks of this repository's tarball as a clean
 * consumer: one published `.f.js` module and a runtime export it must load;
 * its `types.ts` spelled as a consumer spells it, `types.js`, which resolves
 * to the shipped `types.d.ts`; a declared type, a value of that type, and one
 * that is not — the negative control, which must fail to type-check. The
 * module is one the compiler accepts whole, so the check also covers what
 * the `.f.js` extension promises a consumer: the file ships, loads, and
 * carries its declaration.
 *
 * @type {PackageConsumer}
 */
export const packageConsumer = {
    module: 'fjs/js/prototype/module.f.js',
    value: 'prototypeNames',
    types: 'fjs/js/prototype/types.js',
    type: 'PrototypeName',
    accepted: 'map',
    refused: 'stone',
}

/**
 * The workflows and environment manifests this repository commits, with its own module as
 * the packed package's consumer. Every platform runs on
 * every pull request: a macOS or Windows failure found only in the merge queue
 * is found after review, by the queue's eviction.
 *
 * @type {() => Effect<NodeOp, 0, number>}
 */
export const main = () => ci({
    nodeExtra: () => [],
    packageConsumer,
    smart: true,
    extraJobs: { website: websiteJob },
    pushBranches: ['**'],
})
