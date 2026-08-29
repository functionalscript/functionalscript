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

/**
 * The whole check, as a file `tsc` reads for itself.
 *
 * `include` does the enumeration, so no shell walks the tree and no path is
 * ever serialised: a space or a quote in a directory name is a JSON string
 * here and a filename to `tsc`, with nothing in between to get it wrong. An
 * empty match is `TS18003`, which names the pattern that found nothing —
 * "checked nothing and passed" is the failure this job most needs to be
 * legible about.
 *
 * An earlier revision walked the tree with `find`, guarded the result with
 * `test -s`, and passed it through `xargs -0`. Do not go back: review found
 * three defects in that mechanism, one of them silent. `find` omitted
 * `.d.cts`; the paths needed escaping to survive the shell; and `xargs` fills
 * a finite command buffer, so a package large enough to overflow it — about
 * twenty times this one — would have been split across several `tsc`
 * invocations, each a separate program, losing cross-file diagnostics and
 * reporting another batch's globals as missing. One `include` has none of
 * them, and root `AGENTS.md` §6 asks for the tool that parses what it checks
 * rather than a pattern approximating one.
 *
 * `**` rather than a list of declaration extensions, for the same reason:
 * a list is a thing that can be wrong, and that one already was. It does mean
 * a package shipping `.ts` sources and no declarations has a nonempty root
 * set, so `TS18003` would not fire — unreachable here, because root
 * `package.json` `files` is an allowlist with no pattern matching a source
 * file. Recorded in `../todo/package-check-unsupported-package-shapes.md`.
 *
 * `exclude` is emptied because the default excludes `node_modules`, which is
 * the only place the artifact exists. `skipLibCheck` is stated rather than
 * left at its default: it is the one option whose flip would stop `tsc`
 * opening these declarations at all, and the job would still pass.
 */
const tsconfig = /** @type {const} */ ({
    include: [`node_modules/${alias}/**/*`],
    exclude: [],
    compilerOptions: {
        module: 'nodenext',
        target: 'esnext',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
    },
})

/**
 * One command per step, so a failure names what failed rather than arriving as
 * an opaque script.
 *
 * The compiler is whatever the project pins, passed through untouched. With no
 * checkout there is no lockfile, so a version chosen here instead would let the
 * registry — or a constant that drifted from `package.json` — decide the
 * verdict.
 *
 * `npm`, `npx` and `tsc` are the only external tools left, and root
 * `AGENTS.md` §6 is why there are no others: `tsc` is the established tool
 * that parses what it checks, and `npm` is the subject — a job proving the
 * package installs for a consumer cannot avoid the consumer's package manager.
 *
 * @type {(pin: string) => readonly string[]}
 */
const commands = pin => [
    'npm init -y > /dev/null',
    // `echo` is the shell's own builtin expanding its own glob; `ls` would be
    // a second process to learn what the shell already knew.
    //
    // No guard against a second `.tgz`: the glob would expand to two names
    // inside one `file:` spec and npm fails ENOENT naming both, which is
    // louder than anything a count check would print.
    `npm install "${alias}@file:$(echo *.tgz)"`,
    `npm install "typescript@${pin}"`,
    `echo '${JSON.stringify(tsconfig)}' > tsconfig.json`,
    'npx tsc',
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
