import { pure } from '../../types/effects/module.f.ts'
import type { NodeProgramOptions } from '../../types/effects/node/module.f.ts'
import { emptyState, type JsModule } from '../../types/effects/node/virtual/module.f.ts'
import { virtual } from '../../types/effects/node/virtual/module.f.ts'
import { assert, assertEq } from '../module.f.ts'
import { test, type Reporter } from './module.f.ts'

type Event =
    | readonly['moduleStart', string]
    | readonly['enter', readonly string[]]
    | readonly['pass', readonly string[], number]
    | readonly['fail', string, readonly string[], unknown, number]
    | readonly['summary', number, number, number]

const makeReporter = (): readonly[Reporter, () => readonly Event[]] => {
    const events: Event[] = []
    const reporter: Reporter = {
        moduleStart: file => { events.push(['moduleStart', file]); return pure(undefined) },
        enter: path => { events.push(['enter', [...path]]); return pure(undefined) },
        pass: (path, duration) => { events.push(['pass', [...path], duration]); return pure(undefined) },
        fail: (file, path, result, duration) => { events.push(['fail', file, [...path], result, duration]); return pure(undefined) },
        summary: (pass, fail, time) => { events.push(['summary', pass, fail, time]); return pure(undefined) },
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

// flat object: two passing tests
export const flat = () => {
    const [events, exit] = run({
        'a.test.f.ts': () => ({ a: ok0, b: ok1 }),
    })
    assertEq(exit, 0)
    const [e0, e1, e2, e3] = events
    assertEq(e0[0], 'moduleStart')
    assert(e1[0] === 'pass' && e1[1][0] === 'a')
    assert(e2[0] === 'pass' && e2[1][0] === 'b')
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
    assert(e2[0] === 'pass' && e2[1][1] === 'add')
    assert(e3[0] === 'pass' && e3[1][1] === 'sub')
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
    assert(e2[0] === 'pass' && e2[1][0] === 'throw' && e2[1][1] === 'a')
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
    assertEq(e2[0], 'fail')
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
    const passEvents = events.filter(e => e[0] === 'pass')
    assertEq(passEvents.length, 2)
    const [p0, p1] = passEvents
    assertEq(p0[1][0], 'outer')
    assertEq(p1[1][1], 'inner')
}

// integer-indexed array keys appear as numeric path segments
export const arrayKeys = () => {
    const [events, exit] = run({
        'a.test.f.ts': () => ({ arr: [ok0, ok0] }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'pass')
    assertEq(passEvents.length, 2)
    assertEq(passEvents[0][1][1], '0')
    assertEq(passEvents[1][1][1], '1')
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
