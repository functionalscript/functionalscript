/**
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 */

import { main, packageConsumer, websiteJob, repositoryWorkflow, websiteWorkflow, websitePath } from './module.f.mjs'
import { ciWorkflow, main as builtIn } from '../module.f.mjs'
import { exitCode } from '../../effects/node/module.f.mjs'
import { virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { utf8ToString } from '../../text/utf8/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { parse as jsonParse } from '../../media/json/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { parseGitHubAction } from '../common/module.f.mjs'
import { miseEnvironment } from '../mise/module.f.mjs'

/**
 * The `gen.ci.yml` a program writes over an empty project — no `Cargo.toml`, no
 * `package.json`, not even the workflows directory: the generator creates it.
 *
 * @type {(program: Effect<NodeOp, 0, number>, filename?: string) => string}
 */
const workflowOf = (program, filename = 'gen.ci.yml') => {
    /** @type {Dir} */
    const root = {}
    const [state, code] = virtualAt(root)(program)
    assertEq(exitCode(code), 0, state.stderr)
    const github = state.root['.github']
    assert(typeof github === 'object' && !(github instanceof Array), github)
    const workflows = github['workflows']
    assert(typeof workflows === 'object' && !(workflows instanceof Array), workflows)
    const file = workflows[filename]
    assert(file instanceof Array && file.length !== 0, file)
    return utf8ToString(file[0])
}

export const proof = {
    sharedChecks: () => {
        const generated = unwrap(parseGitHubAction(unwrap(jsonParse(workflowOf(main())))))
        assertStructurallySame(generated, repositoryWorkflow)
        const checks = ciWorkflow({ nodeExtra: () => [], packageConsumer, smart: true })(true)
        assertStructurallySame(generated, checks)
        assertEq(Object.keys(generated.jobs).length, 9)
        for (const job of Object.values(generated.jobs)) {
            assertStructurallySame(job?.env, miseEnvironment)
        }
        assertStructurallySame(generated.on, { pull_request: {}, merge_group: {} })
        const [state] = virtualAt({})(main())
        const github = state.root['.github']
        assert(typeof github === 'object' && !(github instanceof Array))
        const workflows = github.workflows
        assert(typeof workflows === 'object' && !(workflows instanceof Array))
        assertStructurallySame(Object.keys(workflows), ['gen.ci.yml', 'gen.npm-publish.yml', 'gen.website.yml'])
    },
    websiteBuild: () => {
        const generated = unwrap(parseGitHubAction(unwrap(jsonParse(workflowOf(main(), 'gen.website.yml')))))
        assertEq(websitePath, '.github/workflows/gen.website.yml')
        assertStructurallySame(generated, websiteWorkflow)
        assertStructurallySame(generated.jobs.website, websiteJob)
        assertStructurallySame(generated.jobs.website?.env, miseEnvironment)
        assertEq(Object.keys(generated.jobs).length, 1)
        assertStructurallySame(generated.on, { pull_request: {}, push: { branches: ['main'] } })
        assert(!workflowOf(main()).includes('sh ./nanvm/demos/gen.build.sh'))
        assertStructurallySame(websiteJob.permissions, { contents: 'read', 'pull-requests': 'write' })
        assertEq(generated.jobs.website?.needs, undefined)
        assertEq(generated.jobs.website?.if, undefined)
        assertStructurallySame(websiteJob.steps.slice(2, 7).map(step => step.run), [
            'mise exec -- npm ci',
            'mise exec -- sh ./nanvm/demos/gen.build.sh',
            'mise exec -- npm run rustdoc-bars',
            'mise exec -- cargo doc --no-deps --workspace',
            'mise exec -- npm run website',
        ])
        assertEq(websiteJob.steps[1]?.with?.install_args, '--locked')
        assertEq(websiteJob.steps[5]?.env?.RUSTDOCFLAGS, '--html-in-header ${{ github.workspace }}/_rustdoc-head.html --html-before-content ${{ github.workspace }}/_rustdoc-header.html --html-after-content ${{ github.workspace }}/_rustdoc-footer.html --extend-css ${{ github.workspace }}/_rustdoc.css')
        assertStructurallySame(websiteJob.steps[6]?.env, {
            WORKERS_CI_COMMIT_SHA: '${{ github.sha }}',
            WORKERS_CI_BRANCH: '${{ github.head_ref || github.ref_name }}',
        })
        assertStructurallySame(websiteJob.steps[4]?.env, websiteJob.steps[6]?.env)
        assert(websiteJob.steps.slice(0, 7).every(step => step.if === undefined && !JSON.stringify(step).includes('secrets.')))
        assert(!workflowOf(builtIn()).includes('sh ./nanvm/demos/gen.build.sh'))
    },
    production: () => {
        const generated = unwrap(parseGitHubAction(unwrap(jsonParse(workflowOf(main(), 'gen.website.yml')))))
        assertStructurallySame(generated.concurrency, {
            group: '${{ github.workflow }}-${{ github.ref }}',
            'cancel-in-progress': "${{ github.event_name != 'push' }}",
        })
        const production = generated.jobs.website?.steps[8]
        assertEq(production?.if, "github.event_name == 'push' && github.ref == 'refs/heads/main'")
        assertEq(production?.run, 'mise exec -- node ./fjs/website/github-deploy.mjs production')
        assertStructurallySame(production?.env, { CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}' })
    },
    deploymentGates: () => {
        const preview = websiteJob.steps[7]
        assertEq(preview?.if, "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository")
        assertEq(preview?.run, 'mise exec -- node ./fjs/website/github-deploy.mjs preview')
        assertEq(websiteJob.steps.length, 9)
        assertStructurallySame(preview?.env, {
            CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
            WORKERS_CI_BRANCH: '${{ github.head_ref }}',
            GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
        })
        const generic = unwrap(parseGitHubAction(unwrap(jsonParse(workflowOf(builtIn())))))
        assertEq(generic.on.push, undefined)
    },
    // The consumer reaches the workflow, and the built-in command — the one
    // any project runs — carries none: that is the difference between the two
    // entry points, and the reason this module exists.
    namesTheConsumerTheBuiltInDoesNot: () => {
        const own = workflowOf(main())
        assert(own.includes(`packed/${packageConsumer.module}`), 'expected the consumer module imported')
        assert(own.includes(' good.mts'), 'expected the consumer steps')
        assert(own.includes('jdx/mise-action@'), 'expected repository mise setup')
        assert(!own.includes('cachix/install-nix-action@'), 'unexpected Nix in repository CI')
        const generic = workflowOf(builtIn())
        assert(!generic.includes(' good.mts'), 'expected no consumer step from the built-in command')
        // Nor does it gate a job on the merge queue: a project without one
        // would never run that job.
        assert(!generic.includes('merge_group\'"'), 'expected no merge-queue-only job from the built-in command')
    },
}
