import { pure } from '../../types/effects/module.f.ts'
import type { NodeProgramOptions, Sandbox, SandboxResult } from '../../types/effects/node/module.f.ts'
import { emptyState, type JsModule } from '../../types/effects/node/virtual/module.f.ts'
import { virtual } from '../../types/effects/node/virtual/module.f.ts'
import { assert, assertEq } from '../module.f.ts'
import {
    test, defaultReporter, fmtPath, fmtTerm, fmtImport, ghEscape, isInteger, isIdentifier,
    type Reporter, type Path,
    defaultTest,
} from './module.f.ts'

type Event =
    | readonly['moduleStart', string]
    | readonly['enter', Path]
    | readonly['result', string, Path, SandboxResult<unknown>]
    | readonly['summary', number, number, number]

type TestReporter = Reporter<Sandbox>

const makeReporter = (): readonly[TestReporter, () => readonly Event[]] => {
    const events: Event[] = []
    const reporter: TestReporter = {
        moduleStart: file => { events.push(['moduleStart', file]); return pure(undefined) },
        enter: path => { events.push(['enter', [...path]]); return pure(undefined) },
        result: (file, path, r) => { events.push(['result', file, [...path], r]); return pure(undefined) },
        summary: (pass, fail, time) => { events.push(['summary', pass, fail, time]); return pure(undefined) },
        test: defaultTest,
    }
    return [reporter, () => events]
}

const options = (initCwd: string, github = false): NodeProgramOptions => ({
    args: [],
    env: { INIT_CWD: initCwd, ...(github ? { GITHUB_ACTION: 'true' } : {}) },
    std: { stdout: { isTTY: false }, stderr: { isTTY: false } },
})

const ok0 = (): unknown => ({ result: ['ok', undefined] as const, duration: 0 })
const fail0 = (): unknown => ({ result: ['error', 'oops'] as const, duration: 0 })
const ok1 = (): unknown => ({ result: ['ok', undefined] as const, duration: 1 })

const run = (dir: Record<string, JsModule>, initCwd = '.'): readonly[readonly Event[], number] => {
    const [reporter, getEvents] = makeReporter()
    const state = { ...emptyState, root: dir }
    const [, exitCode] = virtual(state)(test(reporter)(options(initCwd)))
    return [getEvents(), exitCode]
}

// Runs the real `defaultReporter` and returns its captured stdout/stderr so the
// terminal and GitHub output formats can be asserted directly.
const runMain = (dir: Record<string, JsModule>, github = false): readonly[string, string, number] => {
    const state = { ...emptyState, root: dir }
    const opts = options('.', github)
    const [finalState, exitCode] = virtual(state)(test(defaultReporter(opts))(opts))
    return [finalState.stdout, finalState.stderr, exitCode]
}

// flat object: two passing tests
export const flat = () => {
    const [events, exit] = run({
        'a.test.f.ts': () => ({ a: ok0, b: ok1 }),
    })
    assertEq(exit, 0)
    const [e0, e1, e2, e3] = events
    assertEq(e0[0], 'moduleStart')
    assert(e1[0] === 'result' && e1[2][0] === 'a')
    assert(e2[0] === 'result' && e2[2][0] === 'b')
    assertEq(e3[0], 'summary')
    const [, pass, fail] = e3
    assertEq(pass, 2)
    assertEq(fail, 0)
}

// nested object: sub-tree triggers enter event
export const nested = () => {
    const [events, exit] = run({
        'n.test.f.ts': () => ({ math: { add: ok0, sub: ok0 } }),
    })
    assertEq(exit, 0)
    const [e0, e1, e2, e3, e4] = events
    assertEq(e0[0], 'moduleStart')
    assert(e1[0] === 'enter' && e1[1][0] === 'math')
    assert(e2[0] === 'result' && e2[2][1] === 'add')
    assert(e3[0] === 'result' && e3[2][1] === 'sub')
    assertEq(e4[0], 'summary')
    const [, pass, fail] = e4
    assertEq(pass, 2)
    assertEq(fail, 0)
}

// throw key: tests inside 'throw' pass on error result
export const throwKey = () => {
    const [events, exit] = run({
        't.test.f.ts': () => ({ throw: { a: fail0 } }),
    })
    assertEq(exit, 0)
    const [e0, e1, e2, e3] = events
    assertEq(e0[0], 'moduleStart')
    assert(e1[0] === 'enter' && e1[1][0] === 'throw')
    assert(e2[0] === 'result' && e2[2][0] === 'throw' && e2[2][1] === 'a')
    assertEq(e3[0], 'summary')
    const [, pass, fail] = e3
    assertEq(pass, 1)
    assertEq(fail, 0)
}

// throw key fails when test does not throw (returns ok in throw context)
export const throwKeyFail = () => {
    const [events, exit] = run({
        't.test.f.ts': () => ({ throw: { a: ok0 } }),
    })
    assertEq(exit, 1)
    const [, , e2, e3] = events
    assertEq(e2[0], 'result')
    const [, pass, fail] = e3
    assertEq(pass, 0)
    assertEq(fail, 1)
}

// mixed pass/fail updates summary counts
export const mixedPassFail = () => {
    const [events, exit] = run({
        'm.test.f.ts': () => ({ good: ok0, bad: fail0 }),
    })
    assertEq(exit, 1)
    const summary = events[events.length - 1]
    assertEq(summary[0], 'summary')
    const [, pass, fail] = summary
    assertEq(pass, 1)
    assertEq(fail, 1)
}

// return-value sub-tree: passing test's return value is walked
export const returnValueSubTree = () => {
    const inner: () => unknown = () => ({ result: ['ok', undefined] as const, duration: 0 })
    const [events, exit] = run({
        'r.test.f.ts': () => ({
            outer: (): unknown => ({
                result: ['ok', { inner }] as const,
                duration: 0,
            }),
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
        'a.test.f.ts': () => ({ arr: [ok0, ok0] }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 2)
    assertEq(passEvents[0][2][1], '0')
    assertEq(passEvents[1][2][1], '1')
}

// non-test files are skipped (only files ending in test.f.ts/js are loaded)
export const nonTestFilesSkipped = () => {
    const [events, exit] = run({
        'helper.ts': () => ({ a: ok0 }),
        'b.test.f.ts': () => ({ x: ok0 }),
    })
    assertEq(exit, 0)
    const starts = events.filter(e => e[0] === 'moduleStart')
    assertEq(starts.length, 1)
    assertEq(starts[0][1], './b.test.f.ts')
}

// multiple test files each emit their own moduleStart
export const multipleFiles = () => {
    const [events, exit] = run({
        'a.test.f.ts': () => ({ x: ok0 }),
        'b.test.f.ts': () => ({ y: ok0 }),
    })
    assertEq(exit, 0)
    const starts = events.filter(e => e[0] === 'moduleStart')
    assertEq(starts.length, 2)
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
        't.test.f.ts': () => ({ here: x.throw }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 1)
    assertEq(passEvents[0][2][0], 'here')
}

// every module export — `default` and named — becomes a top-level path segment
export const namedExports = () => {
    const [events, exit] = run({
        'e.test.f.ts': () => ({ default: ok0, helper: ok0 }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 2)
    assertEq(passEvents[0][2][0], 'default')
    assertEq(passEvents[1][2][0], 'helper')
}

// the default (non-GitHub) reporter formats module/pass/summary lines on stdout
export const defaultReporterOutput = () => {
    const [stdout, stderr, exit] = runMain({
        'a.test.f.ts': () => ({ x: ok0 }),
    })
    assertEq(exit, 0)
    assertEq(stderr, '')
    assertEq(
        stdout,
        'import("./a.test.f.ts").x(): ok, 0.0000 ms\n'
        + 'Number of tests: pass: 1, fail: 0, total: 1\n'
        + 'Time: 0.0000 ms\n',
    )
}

// a failure on the non-GitHub reporter writes the error to stderr, not stdout
export const defaultReporterFailOutput = () => {
    const [, stderr, exit] = runMain({
        'a.test.f.ts': () => ({ bad: fail0 }),
    })
    assertEq(exit, 1)
    assertEq(stderr, 'import("./a.test.f.ts").bad(): error, 0.0000 ms\noops\n')
}

// the GitHub reporter emits an `::error` annotation with a percent-encoded
// title (the JSON path) and message
export const githubReporterOutput = () => {
    const [, stderr, exit] = runMain({
        's.test.f.ts': () => ({ 'a:b,c%d': fail0 }),
    }, true)
    assertEq(exit, 1)
    assertEq(
        stderr,
        '::error file=./s.test.f.ts,line=1,title=import("./s.test.f.ts")["a%3Ab%2Cc%25d"]()::oops\n',
    )
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
    fmtImport: () => {
        assertEq(fmtImport('./a.test.f.ts', []), 'import("./a.test.f.ts")()')
        assertEq(fmtImport('./a.test.f.ts', ['math', 'add']), 'import("./a.test.f.ts").math.add()')
        assertEq(fmtImport('./a.test.f.ts', ['users', '3']), 'import("./a.test.f.ts").users[3]()')
        assertEq(fmtImport('./a.test.f.ts', ['x', 'hello world']), 'import("./a.test.f.ts").x["hello world"]()')
        assertEq(fmtImport('./a.test.f.ts', ['outer', null, 'inner']), 'import("./a.test.f.ts").outer().inner()')
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
    },
    ghEscape: () => {
        assertEq(ghEscape('a%b'), 'a%25b')
        assertEq(ghEscape('a:b'), 'a%3Ab')
        assertEq(ghEscape('a,b'), 'a%2Cb')
        assertEq(ghEscape('a\r\nb'), 'a%0D%0Ab')
        assertEq(ghEscape('a%b:c,d'), 'a%25b%3Ac%2Cd')
    },
}
