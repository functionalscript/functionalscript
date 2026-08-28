/**
 * The packed-package check: a job that consumes the `npm pack` artifact the
 * way an outside consumer would.
 *
 * @module
 *
 * @import { Job } from '../common/types.ts'
 */

import { images, node, typescript } from '../config/module.f.mjs'
import { uses } from '../common/module.f.mjs'
import { packageArtifact, packageJobId } from '../node/module.f.mjs'

export const packageCheckJobId = /** @type {const} */ ('package-check')

// Deliberately not built through `toSteps`: that helper injects
// `actions/checkout`, and the missing checkout is this job's whole point. With
// no repository on the runner there is no `tsconfig.json` up the tree to
// inherit, no `node_modules` to resolve into, and no source file that could
// stand in for a declaration the tarball omits — so the job can only see what
// a real consumer sees.
// One step per stage, so a failure names the stage that failed instead of
// arriving as one opaque script.

// A fixed alias, so every later step names the package literally. The
// artifact's own name would otherwise have to be derived and carried between
// steps, and `fjs ci` generates workflows for projects whose package is not
// this one. The narrow case an alias gives up: a package that imports itself by
// name — legal once `exports` is declared — does not resolve under a different
// directory name, so such a package would fail a check a real consumer passes.
// Nothing here self-references; revisit this if that changes.
const alias = /** @type {const} */ ('packed')

const installArtifact = /** @type {const} */ (`npm init -y > /dev/null
# One archive, or which package is under test is ambiguous.
test "$(ls *.tgz | wc -l)" -eq 1
npm install "${alias}@file:$(ls *.tgz)"`)

const installCompiler = /** @type {const} */ (`npm install "typescript@${typescript}"`)

// Every declaration the package ships, enumerated from the installed artifact:
// a hand-written import list cannot see a module that gains a private type
// module later, which is the case this check exists to catch. An empty list
// would type-check nothing and pass. Each path is quoted because `tsc` splits
// a response file on whitespace, so a directory with a space in its name would
// otherwise fail a package that is perfectly valid.
const enumerateDeclarations = /** @type {const} */ (`find node_modules/${alias} \\( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' \\) -printf '"%p"\\n' > declarations.txt
test -s declarations.txt`)

// skipLibCheck stays at its false default: it is what makes tsc open these
// declarations and report a reference the tarball does not carry.
const typeCheck = /** @type {const} */ (`npx tsc --module nodenext --moduleResolution nodenext --target esnext --strict --noEmit --skipLibCheck false @declarations.txt`)

/**
 * Downloads the packed tarball, installs it as a real dependency, and
 * type-checks every declaration it ships.
 *
 * @type {Job}
 */
export const packageCheckJob = {
    'runs-on': images.ubuntu.arm,
    // Without this the two jobs race and the download fails before the check
    // has run — red for a reason unrelated to what it tests.
    needs: [packageJobId],
    steps: [
        uses('actions/download-artifact', { name: packageArtifact }),
        uses('actions/setup-node', { 'node-version': node.default }),
        { run: installArtifact },
        { run: installCompiler },
        { run: enumerateDeclarations },
        { run: typeCheck },
    ],
}
