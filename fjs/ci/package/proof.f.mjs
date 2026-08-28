import { packageCheckJob, packageCheckJobId } from './module.f.mjs'
import { packageArtifact, packageJobId } from '../node/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

// A pin no configuration anywhere holds, so an assertion that finds it can only
// have found the value passed in. Importing the generator's own constant would
// compare it with itself and hold for any value.
const pin = /** @type {const} */ ('=1.2.3-proof')

const job = packageCheckJob(pin)

/** @type {(fragment: string) => boolean} */
const scriptHas = fragment => job.steps.some(step => step.run?.includes(fragment) === true)

export const proof = {
    // The defining property. With a checkout there is a tsconfig.json up the
    // tree, a node_modules to resolve into, and source files that can stand in
    // for a declaration the tarball omits — the check would then pass on the
    // repository rather than on the package.
    noCheckout: () => {
        assertEq(packageCheckJobId, 'package-check')
        assert(
            !job.steps.some(step => step.uses?.startsWith('actions/checkout@') === true),
            'the package check must not check out the repository')
    },
    consumesTheArtifact: () => {
        // Ordered after the producer: without this the two race and the
        // download fails before the check has run.
        assertEq(job.needs?.[0], packageJobId)
        assertEq(job.needs?.length, 1)
        // Downloaded by the name the producer exports, not a second literal
        // that can drift from it.
        const download = job.steps.find(
            step => step.uses?.startsWith('actions/download-artifact@') === true)
        assertEq(download?.with?.name, packageArtifact)
    },
    // Each of these is what makes the job able to fail at all, and each has a
    // silent failure mode rather than a loud one.
    canFail: () => {
        // `true` stops the checking without saying so.
        assert(scriptHas('--skipLibCheck false'), 'expected skipLibCheck left false')
        // An empty list type-checks nothing and passes.
        assert(scriptHas('test -s declarations'), 'expected a guard against an empty file list')
    },
    // The compiler is whatever the package pins, carried through untouched. A
    // check that runs a compiler the package did not choose is a green result
    // about the wrong thing.
    installsTheGivenPin: () => {
        assert(scriptHas(`"typescript@${pin}"`), 'expected the supplied pin installed')
    },
    // `fjs ci` generates workflows for other projects, so the artifact's own
    // package name is whatever that project publishes. Installing under a fixed
    // alias keeps every later step literal; hard-coding this repository's name
    // instead would fail for them — or worse, silently check a dependency that
    // happens to share the name instead of the artifact just built.
    anyPackageName: () => {
        assert(scriptHas('"packed@file:$(ls *.tgz)"'), 'expected the artifact installed under the fixed alias')
        assert(scriptHas('find node_modules/packed'), 'expected declarations enumerated from that directory')
        // Paths reach tsc as arguments, so a space or a quote in one needs no
        // quoting or escaping to survive.
        assert(scriptHas('-print0'), 'expected NUL-separated paths')
        assert(scriptHas('xargs -0'), 'expected the paths passed as arguments')
        // Every declaration form the package can ship, not just the two this
        // repository happens to emit.
        for (const ext of /** @type {const} */ (['*.d.ts', '*.d.mts', '*.d.cts'])) {
            assert(scriptHas(`-name '${ext}'`), `expected ${ext} enumerated`)
        }
        assert(
            !scriptHas('node_modules/functionalscript'),
            'the package check must not hard-code this repository\'s package name')
    },
}
