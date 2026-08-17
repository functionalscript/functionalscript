/**
 * @import { Effect } from '../effects/types.ts'
 * @import { IoEffect, NotImplemented } from '../effects/io/types.ts'
 * @import { NodeProgramOptions, OpResult, Sandbox, Write } from '../effects/node/types.ts'
 * @import { JsModule } from '../effects/node/virtual/types.ts'
 * @import { Reporter } from './types.ts'
 * @import { All, Await, Import, Readdir, Test, TestContext } from '../effects/node/types.ts'
 * @import { Ts } from '../types/rtti/ts/types.ts'
 */

import { log } from '../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { assert, assertEq, todo } from '../asserts/module.f.mjs'
import {
    testAll, fmtPath, fmtTerm, fmtImport, ghEscape, isInteger, isIdentifier,
    registerModule, parseTestSet,
    defaultTest, main, register,
} from './module.f.mjs'
import { run as mockRun } from '../effects/mock/module.f.mjs'
import { shouldLoad } from '../dev/module.f.mjs'
import { parse as parseJson } from '../media/json/module.f.mjs'
import { array, number as rttiNumber, or, string as rttiString } from '../types/rtti/module.f.mjs'
import { parse as rttiParse } from '../types/rtti/parse/module.f.mjs'
import { error, ok, unwrap } from '../types/result/module.f.mjs'

/**
 * The mock reporter's stdout lines. A schema rather than a hand-written type:
 * the events round-trip through JSON, and this is what turns a line back into
 * a typed value without an `as` cast — a shape change fails at the parse
 * instead of silently at an assertion.
 *
 * `Reporter.result` also receives the test's `SandboxResult`, which is not
 * written: no assertion here reads it, and its `undefined` payloads have no
 * JSON representation to round-trip through anyway.
 */
const event = or(
    /** @type {const} */ (['result', rttiString, array(or(rttiString, null))]),
    /** @type {const} */ (['summary', rttiNumber, rttiNumber, rttiNumber]),
)

/** @typedef {Ts<typeof event>} _Event */

const parseEvent = rttiParse(event)

/** @typedef {Reporter<Sandbox | Write>} _TestReporter */

/** @type {(e: _Event) => IoEffect<Write, void, NotImplemented>} */
const writeEvent = e => log(JSON.stringify(e))

/** @type {(stdout: string) => readonly _Event[]} */
const parseEvents = stdout =>
    stdout === '' ? [] : stdout.trimEnd().split('\n')
        .map(line => unwrap(parseEvent(unwrap(parseJson(line)))))

/** @type {() => _TestReporter} */
const makeReporter = () => ({
    result: (file, path, _r, _throws) => writeEvent(['result', file, [...path]]),
    summary: (pass, fail, time) => writeEvent(['summary', pass, fail, time]),
    test: defaultTest,
})

/** @type {(initCwd: string, github?: boolean) => NodeProgramOptions} */
const options = (initCwd, github = false) => ({
    ...defaultNodeProgramOptions,
    env: { INIT_CWD: initCwd, ...(github ? { GITHUB_ACTIONS: 'true' } : {}) },
})

/** @type {() => unknown} */
const ok0 = () => ({ result: /** @type {const} */ (['ok', undefined]), duration: 0 })
/** @type {() => unknown} */
const fail0 = () => ({ result: /** @type {const} */ (['error', 'oops']), duration: 0 })
/** @type {() => unknown} */
const ok1 = () => ({ result: /** @type {const} */ (['ok', undefined]), duration: 1 })

/** @type {(dir: Record<string, JsModule>, initCwd?: string) => readonly [readonly _Event[], number]} */
const run = (dir, initCwd = '.') => {
    const reporter = makeReporter()
    const state = { ...emptyState, root: dir }
    const [finalState, exitCode] = virtual(state)(testAll(reporter)(options(initCwd)))
    return [parseEvents(finalState.stdout), exitCode]
}

// Runs the `fjs t` entry point (`main`) and returns its captured stdout/stderr
// so the terminal and GitHub output formats can be asserted directly.
/** @type {(dir: Record<string, JsModule>, github?: boolean) => readonly [string, string, number]} */
const runMain = (dir, github = false) => {
    const state = { ...emptyState, root: dir }
    const opts = options('.', github)
    const [finalState, exitCode] = virtual(state)(main(opts))
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
    /** @type {() => unknown} */
    const inner = () => ({ result: /** @type {const} */ (['ok', undefined]), duration: 0 })
    const [events, exit] = run({
        'r.proof.f.ts': () => ({
            proof: {
                outer: () => ({
                    result: /** @type {const} */ (['ok', { inner }]),
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

/** @typedef {All | Import | Readdir | Sandbox | Write} _FailOps */

// A reporter that cannot write neither panics nor reports success. The failed
// `result` line short-circuits its own test, leaves `allOk` as the first error,
// skips the summary, and reaches the program tail — which answers exit `1`.
//
// `write` fails for every stream here, including the one `errorExit` reports
// the failure on, so the exit code rather than a message is what is observable:
// a run that cannot say anything at all still says it failed.
export const reporterWriteFailure = () => {
    /** @type {(s: undefined) => <T>(e: Effect<_FailOps, T>) => readonly [undefined, T]} */
    let runner
    runner = mockRun(/** @type {Parameters<typeof mockRun<_FailOps, undefined>>[0]} */ ({
        readdir: (_path, _o) => s => [s, ok([{ name: 'a.proof.f.ts', parentPath: '.', isFile: true }])],
        import: _path => s => [s, ok({ proof: { x: () => { } } })],
        all: (...effects) => s => {
            const [st, rs] = effects.reduce(
                ([st1, rs1], e) => {
                    const [ns, r] = runner(st1)(e)
                    return [ns, [...rs1, r]]
                },
                /** @type {readonly [undefined, readonly unknown[]]} */([s, []]),
            )
            return [st, ok(rs)]
        },
        sandbox: (/** @type {() => unknown} */ f) => (/** @type {undefined} */ s) =>
            [s, ok({ result: ok(f()), duration: 0 })],
        write: (_stream, _data) => s => [s, error(/** @type {const} */(['notImplemented', 'write']))],
    }))
    const [, exitCode] = runner(undefined)(
        /** @type {Effect<_FailOps, number>} */(main(options('.'))))
    assertEq(exitCode, 1)
}

/** @typedef {readonly string[]} _RegisterMockState */

/** @typedef {Test | All | Await} _RegisterMockOps */

/**
 * @typedef {(s: _RegisterMockState) => <T>(e: Effect<_RegisterMockOps, T>) => readonly [_RegisterMockState, T]} _RegisterRunner
 */

/**
 * The `test` op body for a `registerModule` mock; `runner` is threaded in explicitly (rather than closed over) so it can recurse into sub-effects returned by `fn`.
 * @typedef {(
 *     runner: _RegisterRunner,
 *     ctx: TestContext,
 *     name: string,
 *     expectFailure: boolean,
 *     fn: (t: TestContext) => Effect<_RegisterMockOps, void>,
 * ) => (s: _RegisterMockState) => readonly [_RegisterMockState, OpResult<void>]} _RegisterTestOp
 */

/** @type {TestContext} */
const registerNoopCtx = { test: (_n, _o, _f) => Promise.resolve() }

/**
 * Builds a synchronous mock runner for `registerModule`'s `Test`/`All`/`Await`
 * effect operations. Only the `test` op varies between call sites (whether it
 * invokes the registered callback), so `all`/`await` are shared here.
 */
/** @type {(testOp: _RegisterTestOp) => _RegisterRunner} */
const makeRegisterRunner = testOp => {
    /** @type {_RegisterRunner} */
    let runner
    runner = mockRun(/** @type {Parameters<typeof mockRun<_RegisterMockOps, _RegisterMockState>>[0]} */ ({
        test: (ctx, name, xf, fn) => testOp(runner, ctx, name, xf, fn),
        all: (...effects) => s => {
            const [st, rs] = effects.reduce(
                ([st1, rs1], e) => {
                    const [ns, r] = runner(st1)(e)
                    return [ns, [...rs1, r]]
                },
                /** @type {readonly [_RegisterMockState, readonly unknown[]]} */ ([s, []]),
            )
            return [st, ok(rs)]
        },
        await: p => s => /** @type {const} */ ([s, ok([p])]),
    }))
    return runner
}

// registerModule appends ' ...' for inline runners (Bun).
// This mock never invokes the registered callback; it only records names.
export const registerSuffixes = () => {
    const runner = makeRegisterRunner((_runner, _ctx, name, _xf, _fn) => s => [[...s, name], ok(undefined)])

    const proof = /** @type {const} */ ({
        ok: () => {},
        throw: { a: () => { throw 'expected' } },
    })

    // Node (star = ''): no suffixes
    const [nodeNames] = runner([])(registerModule(registerNoopCtx, './a.f.ts', proof, ''))
    assertEq(nodeNames.length, 2)
    assert(nodeNames[0] === 'import("./a.f.ts").proof.ok()')
    assertEq(nodeNames[1], 'import("./a.f.ts").proof.throw.a()')

    // Bun (star = ' ...'): ... on normal tests, path shows throw for throw-tests
    const [inlineNames] = runner([])(registerModule(registerNoopCtx, './a.f.ts', proof, ' ...'))
    assertEq(inlineNames.length, 2)
    assert(inlineNames[0] === 'import("./a.f.ts").proof.ok() ...')
    assertEq(inlineNames[1], 'import("./a.f.ts").proof.throw.a()')
}

// A `throw`-tagged test whose function completes without throwing (the
// external framework, not this module, is responsible for turning that into
// a failure via `expectFailure`). registerModule's own callback must still
// short-circuit before walking the returned value for sub-tests: it invokes
// the callback and returns without recursing, rather than treating the
// returned object as a sub-tree.
export const registerThrowsWithoutThrowing = () => {
    // Unlike registerSuffixes' mock, this one actually invokes the registered
    // callback so registerOne's inner `.step` body runs, and asserts the
    // callback is registered with `expectFailure: true`.
    const runner = makeRegisterRunner((runner, ctx, name, xf, fn) => s => {
        assert(xf)
        const [ns] = runner(s)(fn(ctx))
        return [[...ns, name], ok(undefined)]
    })

    // Returns a sub-tree that would register more tests if it were walked.
    const proof = /** @type {const} */ ({ throw: { a: () => ({ sub: () => {} }) } })

    const [names] = runner([])(registerModule(registerNoopCtx, './a.f.ts', proof, ''))
    // Only the throw-test itself is registered; `sub` is never reached.
    assertEq(names.length, 1)
    assertEq(names[0], 'import("./a.f.ts").proof.throw.a()')
}

// registerModule with an empty proof object registers zero tests and
// returns without invoking the mock's `test` op at all.
export const registerEmptyProof = () => {
    const runner = makeRegisterRunner((_runner, _ctx, name, _xf, _fn) => s => [[...s, name], ok(undefined)])
    const [names] = runner([])(registerModule(registerNoopCtx, './a.f.ts', {}, ''))
    assertEq(names.length, 0)
}

// register (the NodeProgram entry point) against an empty virtual root: no
// modules to register means registerModuleMap short-circuits before ever
// calling the selected TestContext's `test` op, so this reaches that branch
// without hitting the virtual harness's `test: todo` stub.
export const registerEmptyModuleMap = () => {
    const state = { ...emptyState, root: {} }
    const [, exitCode] = virtual(state)(register(options('.')))
    assertEq(exitCode, 0)
}

// register's `star`/`ctx` selection, proven observably: the virtual harness's
// own `test` op is `todo`, so a non-empty root can't go through `virtual()`
// here without throwing. Instead this interprets register's effect with a
// fully synthetic runner (discovery faked via `readdir`/`import`, mirroring
// makeRegisterRunner's approach to `test`/`all`/`await`) that records which
// TestContext object and which registered name each `test` call received —
// so a swapped `engine` ternary or a deleted `inlineTestContext` branch
// changes what's observed here, not just whether the line ran.
export const registerSelectsContextAndStar = () => {
    /** @type {TestContext} */
    const nodeCtx = { test: todo }
    /** @type {TestContext} */
    const bunCtx = { test: todo }

    /** @type {(extra: Partial<NodeProgramOptions>) => readonly (readonly [TestContext, string])[]} */
    const runRegister = extra => {
        /** @type {(readonly [TestContext, string])[]} */
        let calls = []
        /** @type {(s: undefined) => <T>(e: Effect<_RegisterMockOps | Readdir | Import, T>) => readonly [undefined, T]} */
        let runner
        runner = mockRun(/** @type {Parameters<typeof mockRun<_RegisterMockOps | Readdir | Import, undefined>>[0]} */ ({
            readdir: (_path, _o) => s => [s, ok([{ name: 'a.proof.f.ts', parentPath: '.', isFile: true }])],
            import: _path => s => [s, ok({ proof: { ok: () => {} } })],
            all: (...effects) => s => {
                const [st, rs] = effects.reduce(
                    ([st1, rs1], e) => {
                        const [ns, r] = runner(st1)(e)
                        return [ns, [...rs1, r]]
                    },
                    /** @type {readonly [undefined, readonly unknown[]]} */ ([s, []]),
                )
                return [st, ok(rs)]
            },
            await: p => s => [s, ok([p])],
            test: (ctx, name, _xf, _fn) => s => { calls = [...calls, [ctx, name]]; return [s, ok(undefined)] },
        }))
        runner(undefined)(/** @type {Effect<_RegisterMockOps | Readdir | Import, number>} */ (register({
            ...defaultNodeProgramOptions, env: {}, testContext: nodeCtx, bunTestContext: bunCtx, ...extra,
        })))
        return calls
    }

    // Node engine, non-inline context: registers under nodeCtx, no ' ...' suffix.
    const nodeCalls = runRegister({})
    assertEq(nodeCalls.length, 1)
    assert(nodeCalls[0][0] === nodeCtx)
    assertEq(nodeCalls[0][1], 'import("./a.proof.f.ts").proof.ok()')

    // Bun engine, inline context: registers under bunCtx, with ' ...' suffix.
    const bunCalls = runRegister({ inlineTestContext: true, engine: 'bun' })
    assertEq(bunCalls.length, 1)
    assert(bunCalls[0][0] === bunCtx)
    assertEq(bunCalls[0][1], 'import("./a.proof.f.ts").proof.ok() ...')
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
            assert(result instanceof Array, result)
            assertEq(result.length, 0)
        },
        functionWithParamsReturnsEmpty: () => {
            const result = parseTestSet(false, (/** @type {number} */ _x) => _x)
            assert(result instanceof Array, result)
            assertEq(result.length, 0)
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
    reporterWriteFailure,
    registerSuffixes,
    registerThrowsWithoutThrowing,
    registerEmptyProof,
    registerEmptyModuleMap,
    registerSelectsContextAndStar,
    defaultReporterExpectedToThrow,
    helpers
}
