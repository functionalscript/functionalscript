import { packageCheckJob, packageCheckJobId } from './module.f.mjs'
import { packageArtifact, packageJobId } from '../node/module.f.mjs'
import { typescript } from '../config/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(fragment: string) => boolean} */
const scriptHas = fragment =>
    packageCheckJob.steps.some(step => step.run?.includes(fragment) === true)

export const proof = {
    // The defining property. With a checkout there is a tsconfig.json up the
    // tree, a node_modules to resolve into, and source files that can stand in
    // for a declaration the tarball omits — the check would then pass on the
    // repository rather than on the package.
    noCheckout: () => {
        assertEq(packageCheckJobId, 'package-check')
        assert(
            !packageCheckJob.steps.some(step => step.uses?.startsWith('actions/checkout@') === true),
            'the package check must not check out the repository')
    },
    consumesTheArtifact: () => {
        // Ordered after the producer: without this the two race and the
        // download fails before the check has run.
        assertEq(packageCheckJob.needs?.[0], packageJobId)
        assertEq(packageCheckJob.needs?.length, 1)
        // Downloaded by the name the producer exports, not a second literal
        // that can drift from it.
        const download = packageCheckJob.steps.find(
            step => step.uses?.startsWith('actions/download-artifact@') === true)
        assertEq(download?.with?.name, packageArtifact)
    },
    // Each of these is what makes the job able to fail at all, and each has a
    // silent failure mode rather than a loud one.
    canFail: () => {
        // `true` stops the checking without saying so.
        assert(scriptHas('--skipLibCheck false'), 'expected skipLibCheck left false')
        // An empty list type-checks nothing and passes.
        assert(scriptHas('test -s declarations.txt'), 'expected a guard against an empty file list')
        // With no checkout there is no lockfile, so the compiler comes from the
        // repository's pin. An unpinned install would let the registry change
        // this check's verdict with no change here.
        assert(scriptHas(`"typescript@${typescript}"`), 'expected the pinned compiler')
    },
    // `fjs ci` generates workflows for other projects, so the artifact's own
    // package name is whatever that project publishes. Installing under a fixed
    // alias keeps every later step literal; hard-coding this repository's name
    // instead would fail for them — or worse, silently check a dependency that
    // happens to share the name instead of the artifact just built.
    anyPackageName: () => {
        assert(scriptHas('"packed@file:$(ls *.tgz)"'), 'expected the artifact installed under the fixed alias')
        // More than one archive leaves it ambiguous which package is under test.
        assert(scriptHas('test "$(ls *.tgz | wc -l)" -eq 1'), 'expected exactly one archive required')
        assert(scriptHas('find node_modules/packed'), 'expected declarations enumerated from that directory')
        // Every declaration form the package can ship, not just the two this
        // repository happens to emit — `fjs ci` generates for projects whose
        // `files` may include CommonJS declarations.
        for (const ext of /** @type {const} */ (['*.d.ts', '*.d.mts', '*.d.cts'])) {
            assert(scriptHas(`-name '${ext}'`), `expected ${ext} enumerated`)
        }
        assert(
            !scriptHas('node_modules/functionalscript'),
            'the package check must not hard-code this repository\'s package name')
    },
}
