/**
 * The packed-package check: steps that install the tarball `npm pack` wrote
 * and use it the way an outside consumer would, in a directory of their own.
 *
 * @module
 *
 * @import { Step } from '../common/types.ts'
 * @import { PackageConsumer } from '../types.ts'
 */

import { node, typescript } from '../config/module.f.js'
import { uses } from '../common/module.f.mjs'

/**
 * The runner's temporary directory, which GitHub empties at the start and at
 * the end of every job — so a directory made in it during the job is one this
 * job made, and holds what this job put there and nothing else.
 */
const runnerTemp = /** @type {const} */ ('${{ runner.temp }}')

/** The consumer project's directory name, under {@link runnerTemp}. */
const consumerName = /** @type {const} */ ('consumer')

/**
 * The consumer project, as a `run` step spells it: one shell word, quoted, so
 * the runner's path reaches the command whole. `RUNNER_TEMP` is the variable
 * the runner sets to {@link runnerTemp}; the shell expands it, so nothing
 * GitHub substitutes is read as shell source.
 *
 * The job that packs makes this directory and packs into it, before
 * {@link packageCheckSteps} run in it.
 */
export const consumerDirectory = /** @type {const} */ (`"$RUNNER_TEMP/${consumerName}"`)

/**
 * The same directory as `working-directory` spells it. No shell reads that
 * field, so the runner's own expression names the path.
 */
const consumerWorkingDirectory = /** @type {const} */ (`${runnerTemp}/${consumerName}`)

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
 * The three patterns are one rule TypeScript and npm disagree about: npm's
 * `**` walks into a dot-prefixed name and TypeScript's does not. So `files`
 * publishes `.d/x.d.ts` and a lone `**` would leave it unchecked — silently,
 * and even when it is the package's `types` entry point. The extra patterns
 * name a dot segment explicitly, which does match: `**\/.*` for a dot-named
 * file, `**\/.*\/**\/*` for anything under a dot-named directory at any
 * depth. Two dot segments in a row (`.a/.b/x.d.ts`) still escape, because the
 * inner `**` has to cross `.b` — see the todo. Enumerating the names instead
 * would need a tool walking the tree, which root `AGENTS.md` §6 rules out.
 *
 * `exclude` is emptied because the default excludes `node_modules`, which is
 * the only place the artifact exists. `skipLibCheck` is stated rather than
 * left at its default: it is the one option whose flip would stop `tsc`
 * opening these declarations at all, and the job would still pass.
 */
const tsconfig = /** @type {const} */ ({
    include: [
        `node_modules/${alias}/**/*`,
        `node_modules/${alias}/**/.*`,
        `node_modules/${alias}/**/.*/**/*`,
    ],
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
 * A string as a TypeScript string literal: JSON's spelling, which TypeScript
 * reads. The encoding is what keeps the negative control honest: a value
 * interpolated raw could make `bad.mts` a syntax error, which the negated
 * compile would count as the type refusing it.
 *
 * @type {(s: string) => string}
 */
const literal = s => JSON.stringify(s)

/**
 * A string as one single-quoted shell word. Nothing inside single quotes is
 * special to the shell but the quote itself, so `'` is written as the quote
 * closed, the character escaped, and the quote reopened. Every consumer
 * string reaches its command through this, the identifiers included, which
 * {@link literal} cannot cover: so a `value` of `x'; printf PWNED; #` is an
 * import the compiler refuses, not a command the runner executes. An
 * unsupported consumer fails the check; it never runs.
 *
 * @type {(s: string) => string}
 */
const shellWord = s => `'${s.replaceAll("'", "'\\''")}'`

/**
 * The two consumer files, as one `echo` each writes them. `good.mts` imports
 * the runtime export and a declared type from the installed package and
 * gives the type a value it accepts; `bad.mts` gives it one it does not.
 * Every string is a {@link literal}; the export and the type are written
 * bare, as the identifiers they are, and one that is not an identifier
 * fails `good.mts`, which is not negated. The shell sees none of it raw:
 * {@link consumerCommands} writes each file as one {@link shellWord}. `.mts`
 * rather than `.ts` because
 * `npm init` declares no `type`, under which `.ts` would read as CommonJS.
 *
 * @type {(consumer: PackageConsumer) => string}
 */
const goodConsumer = consumer => [
    `import { ${consumer.value} } from ${literal(`${alias}/${consumer.module}`)};`,
    `import type { ${consumer.type} } from ${literal(`${alias}/${consumer.types}`)};`,
    `const accepted: ${consumer.type} = ${literal(consumer.accepted)};`,
    `if (${consumer.value} === undefined) { throw new Error(${literal(`${consumer.value} did not load`)}); }`,
].join('\n')

/** @type {(consumer: PackageConsumer) => string} */
const badConsumer = consumer => [
    `import type { ${consumer.type} } from ${literal(`${alias}/${consumer.types}`)};`,
    `const refused: ${consumer.type} = ${literal(consumer.refused)};`,
].join('\n')

/**
 * The compiler over one consumer file: flags rather than the job's
 * `tsconfig.json`, whose `include` is the package tree. That file is still
 * in the directory, and TypeScript 7 refuses files on the command line while
 * one is present (`TS5112`) unless told to ignore it, so `--ignoreConfig`
 * says so; the first run of this job in CI failed on exactly that, where a
 * dry run in a directory without the file had passed. `nodenext` is the
 * resolution a Node consumer gets, and `strict` is what makes a declaration
 * that failed to resolve an error rather than an `any`.
 */
const consumerTsc = /** @type {const} */ ('npx tsc --pretty false --ignoreConfig --noEmit --strict --module nodenext --target esnext')

/**
 * One command per step, so a failure names what failed rather than arriving as
 * an opaque script.
 *
 * The compiler is `../config/module.f.js`'s, installed from npm as a consumer
 * installs it, rather than taken from the flake the rest of the job enters:
 * entering that flake would put this repository's toolchain on `PATH` in the
 * one place nothing of the repository should be in reach. It is the same
 * version the shell provides through Nix, so the declarations in the tarball
 * are read by the compiler that emitted them.
 *
 * That version must stay exact for a reason peculiar to this check: the
 * consumer project has no lockfile, so a range would let a later registry
 * release change the verdict with nothing here changing. It is a constant
 * rather than a range by construction now — the earlier design read it out of
 * the project's `package.json`, where it could be written as one, and
 * validated it.
 *
 * `npm`, `npx` and `tsc` are the only external tools left, and root
 * `AGENTS.md` §6 is why there are no others: `tsc` is the established tool
 * that parses what it checks, and `npm` is the subject — a check proving the
 * package installs for a consumer cannot avoid the consumer's package manager.
 * `npx` stays here, unlike in every other step: it runs the compiler this
 * check just installed into a directory it built, which is the point.
 *
 * @type {readonly string[]}
 */
const declarationCommands = [
    'npm init -y > /dev/null',
    // `echo` is the shell's own builtin expanding its own glob; `ls` would be
    // a second process to learn what the shell already knew.
    //
    // No guard against a second `.tgz`: the glob would expand to two names
    // inside one `file:` spec and npm fails ENOENT naming both, which is
    // louder than anything a count check would print.
    `npm install "${alias}@file:$(echo *.tgz)"`,
    `npm install "typescript@${typescript.version}"`,
    `echo '${JSON.stringify(tsconfig)}' > tsconfig.json`,
    'npx tsc',
]

/**
 * The consumer's half: the declarations above are read as a set, but a
 * consumer reaches one through an import specifier, and the runtime file
 * beside it has to load. `good.mts` passes the compiler and runs; then
 * `bad.mts`, differing only in the value it gives the declared type, must
 * fail the same compiler — negated, so the step is red when it passes. The
 * negation is what the check rests on: were the declaration missing, `strict`
 * would have failed `good.mts` first, so the one way left for `bad.mts` to
 * fail is the type it names refusing the value.
 *
 * It is the caller's to supply, through `Setup`: `fjs ci` generates this job
 * for any project, and the generator cannot know what another package
 * publishes, so a project that names no consumer gets the declaration check
 * alone — what every project got before the consumer half existed — rather
 * than a `TS2307` for a module its tarball never held.
 *
 * @type {(consumer: PackageConsumer) => readonly string[]}
 */
const consumerCommands = consumer => [
    `echo ${shellWord(goodConsumer(consumer))} > good.mts`,
    `echo ${shellWord(badConsumer(consumer))} > bad.mts`,
    `${consumerTsc} good.mts`,
    'node good.mts',
    `! ${consumerTsc} bad.mts`,
]

/**
 * Installs the packed tarball as a real dependency, type-checks every
 * declaration it ships with the compiler the CI configuration names, and,
 * given a consumer, imports the published module it names from a consumer
 * file, runs it, and type-checks a use of its declaration with a negative
 * control that must fail.
 *
 * These are steps, not a job, and they run last in the job that packs. As a
 * job of their own they waited for that one (`needs`), and GitHub creates a
 * waiting job only when the job it waits for has finished — so whenever the
 * runner queue was full, the check joined the back of it and waited a second
 * time, for seconds of work.
 *
 * What made the separate job a clean consumer was that its runner had no
 * checkout. Every run step here starts in {@link consumerDirectory} instead,
 * which keeps each property that gave:
 *
 * - **Nothing of the repository up the tree.** The directory is under the
 *   runner's temporary directory, not inside the checkout and not above it,
 *   so there is no `tsconfig.json` to inherit, no `node_modules` for Node or
 *   `tsc` to resolve into, and no source file that could stand in for a
 *   declaration the tarball omits. Both resolve by walking up from the file
 *   that imports, and the walk never reaches the checkout.
 * - **Nothing but the tarball in it.** The job makes it with a `mkdir` that
 *   fails if it already exists, and `npm pack` writes the tarball into it.
 * - **No repository toolchain on `PATH`.** No step here enters the flake: each
 *   Nix step entered its shell for its own command alone, so the `node`,
 *   `npm` and `npx` here are `setup-node`'s, as a consumer's would be.
 *
 * What the same runner still holds is outside a consumer's resolution: the
 * checkout beside it, the Nix store, and the npm cache `npm ci` filled, which
 * hands out package contents only against their recorded integrity.
 *
 * Deliberately not built through `toSteps`: that helper injects
 * `actions/checkout`, and the job these steps join has already checked out.
 *
 * @type {(consumer: PackageConsumer | undefined) => readonly Step[]}
 */
export const packageCheckSteps = consumer => [
    uses('actions/setup-node', { 'node-version': node.default }),
    ...[...declarationCommands, ...(consumer === undefined ? [] : consumerCommands(consumer))]
        .map(run => ({ run, 'working-directory': consumerWorkingDirectory })),
]
