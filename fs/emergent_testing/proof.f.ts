import type { Effect } from '../effects/module.f.ts'
import { log, type NodeProgramOptions, type Sandbox, type SandboxResult, type Write } from '../effects/node/module.f.ts'
import { defaultNodeProgramOptions, emptyState, type JsModule } from '../effects/node/virtual/module.f.ts'
import { virtual } from '../effects/node/virtual/module.f.ts'
import { assert, assertEq } from '../asserts/module.f.ts'
import {
    testAll, defaultReporter, fmtPath, fmtTerm, fmtImport, ghEscape, isInteger, isIdentifier,
    registerModule, parseTestSet,
    type Reporter, type Path,
    defaultTest,
} from './module.f.ts'
import { run as mockRun } from '../effects/mock/module.f.ts'
import type { All, Await, Test, TestContext } from '../effects/node/module.f.ts'
import { shouldLoad } from '../dev/module.f.ts'

type Event =
    | readonly ['result', string, Path, SandboxResult<unknown>]
    | readonly ['summary', number, number, number]

type TestReporter = Reporter<Sandbox | Write>

const writeEvent = (event: Event) => log(JSON.stringify(event))

const parseEvents = (stdout: string): readonly Event[] =>
    stdout === '' ? [] : stdout.trimEnd().split('\n').map(line => JSON.parse(line))

const makeReporter = (): TestReporter => ({
    result: (file, path, r, _throws) => writeEvent(['result', file, [...path], r]),
    summary: (pass, fail, time) => writeEvent(['summary', pass, fail, time]),
    test: defaultTest,
})

const options = (initCwd: string, github = false): NodeProgramOptions => ({
    ...defaultNodeProgramOptions,
    env: { INIT_CWD: initCwd, ...(github ? { GITHUB_ACTIONS: 'true' } : {}) },
})

const ok0 = (): unknown => ({ result: ['ok', undefined] as const, duration: 0 })
const fail0 = (): unknown => ({ result: ['error', 'oops'] as const, duration: 0 })
const ok1 = (): unknown => ({ result: ['ok', undefined] as const, duration: 1 })

const run = (dir: Record<string, JsModule>, initCwd = '.'): readonly [readonly Event[], number] => {
    const reporter = makeReporter()
    const state = { ...emptyState, root: dir }
    const [finalState, exitCode] = virtual(state)(testAll(reporter)(options(initCwd)))
    return [parseEvents(finalState.stdout), exitCode]
}

// Runs the real `defaultReporter` and returns its captured stdout/stderr so the
// terminal and GitHub output formats can be asserted directly.
const runMain = (dir: Record<string, JsModule>, github = false): readonly [string, string, number] => {
    const state = { ...emptyState, root: dir }
    const opts = options('.', github)
    const [finalState, exitCode] = virtual(state)(testAll(defaultReporter(opts))(opts))
    return [finalState.stdout, finalState.stderr, exitCode]
}

// flat object: two passing tests
export const flat = () => {
    const [events, exit] = run({
        'a.proof.f.ts': () => ({ proof: { a: ok0, b: ok1 } }),
    })
    assertEq(exit, 0)
    const [e0, e1, e2] = events
    assert(e0[0] === 'result' && e0[2][0] === 'a')
    assert(e1[0] === 'result' && e1[2][0] === 'b')
    assert(e2[0] === 'summary')
    const [, pass, fail] = e2
    assertEq(pass, 2)
    assertEq(fail, 0)
}

// nested object: leaf tests carry the full path including the sub-tree key
export const nested = () => {
    const [events, exit] = run({
        'n.proof.f.ts': () => ({ proof: { math: { add: ok0, sub: ok0 } } }),
    })
    assertEq(exit, 0)
    const [e0, e1, e2] = events
    assert(e0[0] === 'result' && e0[2][1] === 'add')
    assert(e1[0] === 'result' && e1[2][1] === 'sub')
    assert(e2[0] === 'summary')
    const [, pass, fail] = e2
    assertEq(pass, 2)
    assertEq(fail, 0)
}

// throw key: tests inside 'throw' pass on error result
export const throwKey = () => {
    const [events, exit] = run({
        't.proof.f.ts': () => ({ proof: { throw: { a: fail0 } } }),
    })
    assertEq(exit, 0)
    const [e0, e1] = events
    assert(e0[0] === 'result' && e0[2][0] === 'throw' && e0[2][1] === 'a')
    assert(e1[0] === 'summary')
    const [, pass, fail] = e1
    assertEq(pass, 1)
    assertEq(fail, 0)
}

// throw key fails when test does not throw (returns ok in throw context)
export const throwKeyFail = () => {
    const [events, exit] = run({
        't.proof.f.ts': () => ({ proof: { throw: { a: ok0 } } }),
    })
    assertEq(exit, 1)
    const [e0, e1] = events
    assert(e0[0] === 'result')
    const [, pass, fail] = e1
    assertEq(pass, 0)
    assertEq(fail, 1)
}

// mixed pass/fail updates summary counts
export const mixedPassFail = () => {
    const [events, exit] = run({
        'm.proof.f.ts': () => ({ proof: { good: ok0, bad: fail0 } }),
    })
    assertEq(exit, 1)
    const summary = events[events.length - 1]
    assert(summary[0] === 'summary')
    const [, pass, fail] = summary
    assertEq(pass, 1)
    assertEq(fail, 1)
}

// return-value sub-tree: passing test's return value is walked
export const returnValueSubTree = () => {
    const inner: () => unknown = () => ({ result: ['ok', undefined] as const, duration: 0 })
    const [events, exit] = run({
        'r.proof.f.ts': () => ({
            proof: {
                outer: (): unknown => ({
                    result: ['ok', { inner }] as const,
                    duration: 0,
                }),
            }
        }),
    })
    // outer passes, then inner (from return value) also passes
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 2)
    const [p0, p1] = passEvents
    assertEq(p0[2][0], 'outer')
    assertEq(p1[2][2], 'inner')
}

// integer-indexed array keys appear as numeric path segments
export const arrayKeys = () => {
    const [events, exit] = run({
        'a.proof.f.ts': () => ({ proof: { arr: [ok0, ok0] } }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 2)
    assertEq(passEvents[0][2][1], '0')
    assertEq(passEvents[1][2][1], '1')
}

// non-proof files are skipped: plain `.ts` is not loaded; `.f.ts` without
// a `proof` export is loaded but produces no events
export const nonTestFilesSkipped = () => {
    const [events, exit] = run({
        'helper.ts': () => ({ a: ok0 }),                // not loaded (plain .ts)
        'module.f.ts': () => ({ someExport: ok0 }),     // loaded, no proof → skipped
        'b.proof.f.ts': () => ({ proof: { x: ok0 } }), // loaded, has proof → runs
    })
    assertEq(exit, 0)
    const results = events.filter(e => e[0] === 'result')
    assertEq(results.length, 1)
    assertEq(results[0][1], './b.proof.f.ts')
}

// multiple test files each produce result events
export const multipleFiles = () => {
    const [events, exit] = run({
        'a.proof.f.ts': () => ({ proof: { x: ok0 } }),
        'b.proof.f.ts': () => ({ proof: { y: ok0 } }),
    })
    assertEq(exit, 0)
    const results = events.filter(e => e[0] === 'result')
    assertEq(results.length, 2)
    const [, pass, fail] = events[events.length - 1]
    assertEq(pass, 2)
    assertEq(fail, 0)
}

// a function literally named `throw` is a throwing test even when its key is not `throw`
export const throwByFunctionName = () => {
    // // `bun` calls the function `named` instead of `throw`
    // const named = ({ throw: () => fail0() }).throw
    const x = { throw: () => fail0() }
    const [events, exit] = run({
        't.proof.f.ts': () => ({ proof: { here: x.throw } }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 1)
    assertEq(passEvents[0][2][0], 'here')
}

// only the `proof` export is used; other module properties are ignored
export const namedExports = () => {
    const [events, exit] = run({
        'e.proof.f.ts': () => ({ proof: { a: ok0, b: ok0 }, other: ok0 }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 2) // `other` is ignored
    assertEq(passEvents[0][2][0], 'a')
    assertEq(passEvents[1][2][0], 'b')
}

// the default (non-GitHub) reporter formats module/pass/summary lines on stdout
export const defaultReporterOutput = () => {
    const [stdout, stderr, exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { x: ok0 } }),
    })
    assertEq(exit, 0)
    assertEq(stderr, '')
    assertEq(
        stdout,
        'import("./a.proof.f.ts").proof.x(): ok, 0.0000 ms\n'
        + 'Number of tests: pass: 1, fail: 0, total: 1\n'
        + 'Time: 0.0000 ms\n',
    )
}

// timeFormat with duration >= 1ms covers the `yl <= 0` branch (no leading zeros needed)
export const defaultReporterOutputLargeDuration = () => {
    const [stdout, , exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { x: ok1 } }),
    })
    assertEq(exit, 0)
    assertEq(
        stdout,
        'import("./a.proof.f.ts").proof.x(): ok, 1.0000 ms\n'
        + 'Number of tests: pass: 1, fail: 0, total: 1\n'
        + 'Time: 1.0000 ms\n',
    )
}

// a failure on the non-GitHub reporter writes the error to stderr, not stdout
export const defaultReporterFailOutput = () => {
    const [, stderr, exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { bad: fail0 } }),
    })
    assertEq(exit, 1)
    assertEq(stderr, 'import("./a.proof.f.ts").proof.bad(): error, 0.0000 ms\noops\n')
}

// the GitHub reporter emits an `::error` annotation with a percent-encoded
// title (the JSON path) and message
export const githubReporterOutput = () => {
    const [, stderr, exit] = runMain({
        's.proof.f.ts': () => ({ proof: { 'a:b,c%d': fail0 } }),
    }, true)
    assertEq(exit, 1)
    assertEq(
        stderr,
        '::error file=./s.proof.f.ts,line=1,title=import("./s.proof.f.ts").proof["a%3Ab%2Cc%25d"]()::oops\n',
    )
}

// registerModule appends ' ...' for inline runners (Bun/Playwright).
// Uses a minimal synchronous mock for the Test/All/Await effect operations.
export const registerSuffixes = () => {
    type S = readonly string[]
    type Ops = Test | All | Await

    let runner!: (s: S) => <T>(e: Effect<Ops, T>) => readonly [S, T]
    const noopCtx: TestContext = { test: (_n, _o, _f) => Promise.resolve() }

    const makeRunner = () => mockRun<Ops, S>({
        test: (_ctx, name, _xf, _fn) => (s: S) => [[...s, name], undefined],
        all: (...effects: readonly Effect<Ops, unknown>[]) => (s: S) => {
            let st = s
            const rs: unknown[] = []
            for (const e of effects) {
                const [ns, r] = runner(st)(e)
                st = ns
                rs.push(r)
            }
            return [st, rs]
        },
        await: p => (s: S) => [s, [p]],
    } as Parameters<typeof mockRun<Ops, S>>[0])

    runner = makeRunner()

    const proof = {
        ok: () => {},
        throw: { a: () => { throw 'expected' } },
    }

    // Node (star = ''): no suffixes
    const [nodeNames] = runner([])(registerModule(noopCtx, './a.f.ts', proof, ''))
    assertEq(nodeNames.length, 2)
    assert(nodeNames[0] === 'import("./a.f.ts").proof.ok()')
    assertEq(nodeNames[1], 'import("./a.f.ts").proof.throw.a()')

    // Bun/Playwright (star = ' ...'): ... on normal tests, path shows throw for throw-tests
    const [inlineNames] = runner([])(registerModule(noopCtx, './a.f.ts', proof, ' ...'))
    assertEq(inlineNames.length, 2)
    assert(inlineNames[0] === 'import("./a.f.ts").proof.ok() ...')
    assertEq(inlineNames[1], 'import("./a.f.ts").proof.throw.a()')
}

// direct unit tests for the pure path-format helpers
export const helpers = {
    isInteger: () => {
        assert(isInteger('0'))
        assert(isInteger('123'))
        assert(!isInteger(''))
        assert(!isInteger('01'))
        assert(!isInteger('1a'))
        assert(!isInteger('-1'))
    },
    isIdentifier: () => {
        assert(isIdentifier('abc'))
        assert(isIdentifier('_x'))
        assert(isIdentifier('$y'))
        assert(isIdentifier('a1'))
        assert(!isIdentifier(''))
        assert(!isIdentifier('1a'))
        assert(!isIdentifier('a-b'))
    },
    shouldLoad: () => {
        // all .f.ts / .f.js — FS modules are safe to bulk-load
        assert(shouldLoad('module.f.ts'))
        assert(shouldLoad('module.f.js'))
        assert(shouldLoad('a.proof.f.ts'))
        assert(shouldLoad('dir/module.f.ts'))
        // vanilla opt-in by filename
        assert(shouldLoad('proof.ts'))
        assert(shouldLoad('proof.js'))
        assert(shouldLoad('proof.mts'))
        assert(shouldLoad('proof.mjs'))
        assert(shouldLoad('math.proof.ts'))
        assert(shouldLoad('math.proof.js'))
        assert(shouldLoad('math.proof.mts'))
        assert(shouldLoad('dir/math.proof.ts'))
        // non-FS, non-proof vanilla files are not loaded
        assert(!shouldLoad('helper.ts'))
        assert(!shouldLoad('module.ts'))
        assert(!shouldLoad('proof.tsx'))
    },
    fmtImport: () => {
        assertEq(fmtImport('./a.proof.f.ts', []), 'import("./a.proof.f.ts").proof()')
        assertEq(fmtImport('./a.proof.f.ts', ['math', 'add']), 'import("./a.proof.f.ts").proof.math.add()')
        assertEq(fmtImport('./a.proof.f.ts', ['users', '3']), 'import("./a.proof.f.ts").proof.users[3]()')
        assertEq(fmtImport('./a.proof.f.ts', ['x', 'hello world']), 'import("./a.proof.f.ts").proof.x["hello world"]()')
        assertEq(fmtImport('./a.proof.f.ts', ['outer', null, 'inner']), 'import("./a.proof.f.ts").proof.outer().inner()')
    },
    fmtPath: () => {
        assertEq(fmtPath([]), '')
        assertEq(fmtPath(['math', 'add']), '.math.add')
        assertEq(fmtPath(['users', '3', 'name']), '.users[3].name')
        assertEq(fmtPath(['x', 'hello world']), '.x["hello world"]')
        assertEq(fmtPath(['outer', null, 'inner']), '.outer().inner')
    },
    fmtTerm: () => {
        assertEq(fmtTerm([]), '()')
        assertEq(fmtTerm(['math', 'add']), '| | add')
        assertEq(fmtTerm(['a', '0']), '| | 0')
        assertEq(fmtTerm(['x', 'hello world']), '| | "hello world"')
        // null marks a function-call boundary; fmtTerm filters it out
        assertEq(fmtTerm(['outer', null, 'inner']), '| | inner')
    },
    ghEscape: () => {
        assertEq(ghEscape('a%b'), 'a%25b')
        assertEq(ghEscape('a:b'), 'a%3Ab')
        assertEq(ghEscape('a,b'), 'a%2Cb')
        assertEq(ghEscape('a\r\nb'), 'a%0D%0Ab')
        assertEq(ghEscape('a%b:c,d'), 'a%25b%3Ac%2Cd')
    },
    parseTestSet: {
        nullReturnsEmpty: () => {
            const result = parseTestSet(false, null)
            assertEq(Array.isArray(result), true)
            assertEq((result as unknown[]).length, 0)
        },
        functionWithParamsReturnsEmpty: () => {
            const result = parseTestSet(false, (_x: number) => _x)
            assertEq(Array.isArray(result), true)
            assertEq((result as unknown[]).length, 0)
        },
    },
}

// a passing throw-test emits '# EXPECTED TO THROW' in its output line
const defaultReporterExpectedToThrow = () => {
    // fail0 returns a SandboxResult indicating an error; in a throw context
    // defaultTest inverts it to ok, so defaultReporter.result sees s==='ok' and throws===true
    const [stdout, , exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { throw: { x: fail0 } } }),
    })
    assertEq(exit, 0)
    assert(stdout.includes('# EXPECTED TO THROW'), stdout)
}

export const proof = {
    flat,
    nested,
    throwKey,
    throwKeyFail,
    mixedPassFail,
    returnValueSubTree,
    arrayKeys,
    nonTestFilesSkipped,
    multipleFiles,
    throwByFunctionName,
    namedExports,
    defaultReporterOutput,
    defaultReporterOutputLargeDuration,
    defaultReporterFailOutput,
    githubReporterOutput,
    registerSuffixes,
    defaultReporterExpectedToThrow,
    helpers
}
