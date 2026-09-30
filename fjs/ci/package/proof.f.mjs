/**
 * @import { PackageConsumer } from '../types.ts'
 */

import { packageCheckJob, packageCheckJobId } from './module.f.mjs'
import { packageArtifact, packageJobId } from '../node/module.f.mjs'
import { typescript } from '../config/module.f.js'
import { packageConsumer } from '../self/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

const job = packageCheckJob(packageConsumer)

/** @type {(fragment: string) => boolean} */
const scriptHas = fragment => job.steps.some(step => step.run?.includes(fragment) === true)

/**
 * The two commands writing a consumer's files, `good.mts` first.
 *
 * @type {(consumer: PackageConsumer) => readonly [string, string]}
 */
const consumerFiles = consumer => {
    const runs = packageCheckJob(consumer).steps.flatMap(step => step.run === undefined ? [] : [step.run])
    const good = runs.find(run => run.endsWith('> good.mts'))
    const bad = runs.find(run => run.endsWith('> bad.mts'))
    assert(good !== undefined && bad !== undefined, 'expected both consumer files written')
    return [good, bad]
}

/** @type {(s: string) => boolean} */
const digits = s => s !== '' && [...s].every(c => c >= '0' && c <= '9')

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
    // The compiler is the CI configuration's, and it has to be an exact
    // version rather than anything npm reads as a range.
    //
    // Asserting the string is in the command would compare the generator's
    // constant with itself, so what is checked here is the property that makes
    // the constant usable: `MAJOR.MINOR.PATCH`, three numeric segments and
    // nothing else. This job runs with no checkout and so with no lockfile —
    // `^7.0.0`, `7.x` or `7.0` would each let a later registry release change
    // the verdict with nothing in this repository changing. The whole value is
    // validated rather than its first character, because a range can begin
    // with a digit.
    installsAnExactVersion: () => {
        const parts = typescript.version.split('.')
        assert(
            parts.length === 3 && parts.every(digits),
            `not an exact version: ${typescript.version}`)
        assert(
            scriptHas(`"typescript@${typescript.version}"`),
            'expected the configured compiler installed')
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
        assert(scriptHas('"node_modules/packed/**/*"'), 'expected the artifact tree enumerated by tsc')
        // npm's `**` walks into a dot-prefixed name and TypeScript's does not,
        // so `files` publishes what a lone `**` would leave unchecked — even
        // the package's own `types` entry point, and without saying so. Each
        // pattern names a dot segment explicitly, which does match.
        assert(scriptHas('"node_modules/packed/**/.*"'), 'expected dot-named files enumerated')
        assert(scriptHas('"node_modules/packed/**/.*/**/*"'), 'expected declarations under a dot-named directory enumerated')
        // The default excludes node_modules, which is the only place the
        // artifact exists.
        assert(scriptHas('"exclude":[]'), 'expected node_modules not excluded')
    },
    // Without a consumer the job is the declaration check alone, step for step
    // what it was before the consumer half existed: `fjs ci` generates it for
    // any project, and a module this repository publishes is not one another
    // package's tarball holds.
    withoutConsumer: () => {
        const bare = packageCheckJob(undefined)
        assert(!bare.steps.some(step => step.run?.includes('.mts') === true), 'expected no consumer step without a consumer')
        assertEq(bare.steps.length, job.steps.length - 5)
        for (const [i, step] of bare.steps.entries()) {
            assertEq(JSON.stringify(step), JSON.stringify(job.steps[i]))
        }
    },
    // The consumer's half of the check, in the order a consumer meets it: the
    // files written, the good one type-checked and run, the bad one refused.
    consumer: {
        importsThePublishedModule: () => {
            // Through the alias, never this repository's package name, and
            // through the specifiers a consumer writes: the runtime `.f.js`
            // and `types.js` for the shipped `types.d.ts`.
            assert(scriptHas(`from "packed/${packageConsumer.module}"`), 'expected the runtime module imported')
            assert(scriptHas(`from "packed/${packageConsumer.types}"`), 'expected the declared type imported')
            assert(
                !job.steps.some(step => step.run?.includes('"functionalscript/') === true),
                'the consumer must import the alias, not this repository\'s package name')
        },
        goodBeforeBad: () => {
            const runs = job.steps.flatMap(step => step.run === undefined ? [] : [step.run])
            const at = /** @type {(start: string, end: string) => number} */ ((start, end) =>
                runs.findIndex(run => run.startsWith(start) && run.endsWith(end)))
            const written = at('echo ', '> good.mts')
            const checked = at('npx tsc ', ' good.mts')
            const ran = at('node ', ' good.mts')
            const refused = at('! npx tsc ', ' bad.mts')
            assert(written !== -1 && checked !== -1 && ran !== -1 && refused !== -1, 'expected the good file written, checked and run, and the bad file refused')
            assert(written < checked && checked < ran && ran < refused, 'expected the good file written, checked and run before the bad file is refused')
        },
        // The negative control is a negated command, so it is red when the bad
        // file type-checks — the outcome a declaration resolved as `any` would
        // give — and nothing else in the job is negated.
        negativeControlMustFail: () => {
            const negated = job.steps.filter(step => step.run?.startsWith('! ') === true)
            assertEq(negated.length, 1)
            assert(negated[0].run?.endsWith(' bad.mts') === true, 'expected the bad file to be the negated check')
            assert(scriptHas(`= "${packageConsumer.refused}"`), 'expected the refused value in the bad file')
            assert(scriptHas(`= "${packageConsumer.accepted}"`), 'expected the accepted value in the good file')
        },
        // The job's own `tsconfig.json` is in the directory when the consumer
        // files are compiled, and TypeScript 7 refuses a file on the command
        // line beside one (`TS5112`) unless told to ignore it. Both consumer
        // compiles say so; the first CI run of this job failed without it.
        ignoresTheJobConfig: () => {
            for (const step of job.steps) {
                if (step.run?.includes('tsc ') === true && step.run.includes('.mts')) {
                    assert(step.run.includes(' --ignoreConfig '), `expected --ignoreConfig: ${step.run}`)
                }
            }
        },
        // A consumer string reaches the source as a TypeScript string literal,
        // whatever it holds: a `"` in the refused value would otherwise make
        // `bad.mts` a syntax error, which the negated compile would count as
        // the type refusing the value.
        encodesTheStrings: () => {
            /** @type {PackageConsumer} */
            const odd = { ...packageConsumer, accepted: 'a"b', refused: 'c"d\\e' }
            const [good, bad] = consumerFiles(odd)
            assert(good.includes('const accepted: PrototypeName = "a\\"b";'), good)
            assert(bad.includes('const refused: PrototypeName = "c\\"d\\\\e";'), bad)
        },
        // Each file reaches the shell as one single-quoted word, so the one
        // character the shell would read inside it, `'`, is the closed quote,
        // an escaped `'` and the quote reopened, wherever it stands: in a
        // literal, or in the identifiers a literal cannot cover. A `value`
        // that reads as a command is then an import the compiler refuses,
        // not a command the runner executes.
        quotesEachFileForTheShell: () => {
            /** @type {PackageConsumer} */
            const odd = { ...packageConsumer, value: "x'; printf PWNED; #", type: "T'", refused: "c'd" }
            const [good, bad] = consumerFiles(odd)
            assert(good.includes(`import { x'\\''; printf PWNED; # } from`), good)
            assert(good.includes(`import type { T'\\'' } from`), good)
            assert(bad.includes(`const refused: T'\\'' = "c'\\''d";`), bad)
            for (const file of [good, bad]) {
                assert(file.startsWith(`echo '`) && file.endsWith(`' > ${file.endsWith('good.mts') ? 'good' : 'bad'}.mts`), file)
                const inner = file.slice(`echo '`.length, file.lastIndexOf(`' > `))
                assert(!inner.replaceAll(`'\\''`, '').includes("'"), `expected every apostrophe escaped: ${file}`)
            }
        },
        // One command per step (root `AGENTS.md` §7): a consumer step never
        // chains, so a red step names the command that failed.
        oneCommandEach: () => {
            for (const step of job.steps) {
                if (step.run?.includes('.mts') === true) {
                    assert(!step.run.includes('&&'), `expected one command: ${step.run}`)
                }
            }
        },
    },
}
