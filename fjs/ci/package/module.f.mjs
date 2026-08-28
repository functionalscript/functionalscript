/**
 * The packed-package check: a job that consumes the `npm pack` artifact the
 * way an outside consumer would.
 *
 * @module
 *
 * @import { Job } from '../common/types.ts'
 */

import { images, node } from '../config/module.f.mjs'
import { uses } from '../common/module.f.mjs'
import { packageArtifact, packageJobId } from '../node/module.f.mjs'

export const packageCheckJobId = /** @type {const} */ ('package-check')

// A fixed alias, so every later command names the package literally. The
// artifact's own name would otherwise have to be derived and carried between
// steps. The narrow case an alias gives up: a package that imports itself by
// name — legal once `exports` is declared — does not resolve under a different
// directory name. Nothing here self-references; revisit if that changes.
const alias = /** @type {const} */ ('packed')

const declarations = /** @type {const} */ ('declarations')

/**
 * One command per step, so a failure names what failed rather than arriving as
 * an opaque script.
 *
 * The compiler is whatever the project pins, passed through untouched. With no
 * checkout there is no lockfile, so a version chosen here instead would let the
 * registry — or a constant that drifted from `package.json` — decide the
 * verdict.
 *
 * @type {(pin: string) => readonly string[]}
 */
const commands = pin => [
    'npm init -y > /dev/null',
    `npm install "${alias}@file:$(ls *.tgz)"`,
    `npm install "typescript@${pin}"`,
    // `-print0` rather than a text list: the paths reach `tsc` as arguments, so
    // a space or a quote in one survives without quoting or escaping.
    `find node_modules/${alias} \\( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' \\) -print0 > ${declarations}`,
    // An empty list would type-check nothing and pass. `tsc` does exit non-zero
    // on no arguments, but by printing usage, which says nothing about why.
    `test -s ${declarations}`,
    // skipLibCheck stays at its false default: it is what makes tsc open these
    // declarations and report a reference the tarball does not carry.
    `xargs -0 npx tsc --module nodenext --moduleResolution nodenext --target esnext --strict --noEmit --skipLibCheck false < ${declarations}`,
]

/**
 * Downloads the packed tarball, installs it as a real dependency, and
 * type-checks every declaration it ships with the compiler the package pins.
 *
 * Deliberately not built through `toSteps`: that helper injects
 * `actions/checkout`, and the missing checkout is this job's whole point. With
 * no repository on the runner there is no `tsconfig.json` up the tree to
 * inherit, no `node_modules` to resolve into, and no source file that could
 * stand in for a declaration the tarball omits — so the job can only see what a
 * real consumer sees.
 *
 * @type {(pin: string) => Job}
 */
export const packageCheckJob = pin => ({
    'runs-on': images.ubuntu.arm,
    // Without this the two jobs race and the download fails before the check
    // has run — red for a reason unrelated to what it tests.
    needs: [packageJobId],
    steps: [
        uses('actions/download-artifact', { name: packageArtifact }),
        uses('actions/setup-node', { 'node-version': node.default }),
        ...commands(pin).map(run => ({ run })),
    ],
})
