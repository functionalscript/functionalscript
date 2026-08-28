import { packageCheckJob, packageCheckJobId } from './module.f.mjs'
import { packageArtifact, packageJobId } from '../node/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

// A pin no configuration anywhere holds, so an assertion that finds it can only
// have found the value passed in. Importing the generator's own constant would
// compare it with itself and hold for any value.
const pin = /** @type {const} */ ('=1.2.3')

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
    // The one option with a silent failure mode: `true` stops tsc opening the
    // declarations at all, and the job still passes. Stated rather than left at
    // its default so a change to it is a change to this file.
    canFail: () => {
        assert(scriptHas('"skipLibCheck":false'), 'expected skipLibCheck left false')
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
        assert(scriptHas('"packed@file:$(echo *.tgz)"'), 'expected the artifact installed under the fixed alias')
        assert(
            !scriptHas('node_modules/functionalscript'),
            'the package check must not hard-code this repository\'s package name')
    },
    // `tsc` enumerates what it checks, from a config file it reads itself. No
    // path passes through the shell, so a space or a quote in a directory name
    // has nothing to survive; an empty match is TS18003 rather than a pass.
    tscEnumerates: () => {
        assert(scriptHas('"include":["node_modules/packed/**/*"]'), 'expected the artifact tree enumerated by tsc')
        // The default excludes node_modules, which is the only place the
        // artifact exists.
        assert(scriptHas('"exclude":[]'), 'expected node_modules not excluded')
    },
}
