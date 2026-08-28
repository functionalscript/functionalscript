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

const installArtifact = /** @type {const} */ (`set -eu
npm init -y > /dev/null
npm install --no-audit --no-fund "${alias}@file:$(ls *.tgz)"`)

const installPinnedCompiler = /** @type {const} */ (`set -eu
# The compiler is the package's own pin, read out of the packed package.json:
# with no checkout there is no lockfile, so an unpinned install would let the
# registry change this check's verdict with no change to the repository.
ts=$(node -p "require('./node_modules/${alias}/package.json').devDependencies?.typescript ?? ''")
# Refuse rather than fall back to a floating compiler.
test -n "$ts"
npm install --no-audit --no-fund "typescript@$ts"
# A dependency specification is not a resolved version: \`^7.0.0\` installs
# whatever the registry publishes next. Compare what was installed against the
# literal pin and refuse when they differ, so the verdict cannot move without a
# change to the package.
installed=$(node -p "require('./node_modules/typescript/package.json').version")
exact=$(SPEC="$ts" node -p "const s = process.env.SPEC; s.startsWith('=') ? s.slice(1) : s")
test "$installed" = "$exact"`)

const enumerateDeclarations = /** @type {const} */ (`set -eu
# Every declaration the package ships, enumerated from the installed artifact.
# A hand-written import list cannot see a module that gains a private type
# module later, which is the case this check exists to catch.
find node_modules/${alias} \\( -name '*.d.ts' -o -name '*.d.mts' \\) > declarations.txt
# An empty list would type-check nothing and pass, which is the one way this
# job can look healthy while checking nothing at all.
test -s declarations.txt`)

const typeCheck = /** @type {const} */ (`set -eu
# skipLibCheck stays at its false default: it is what makes tsc open these
# declarations and report a reference the tarball does not carry.
npx tsc --module nodenext --moduleResolution nodenext --target esnext --strict --noEmit --skipLibCheck false @declarations.txt`)

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
        { run: installPinnedCompiler },
        { run: enumerateDeclarations },
        { run: typeCheck },
    ],
}
