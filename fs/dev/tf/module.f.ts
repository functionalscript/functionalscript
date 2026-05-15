/**
 * Test-framework helpers for running and reporting FunctionalScript tests.
 *
 * @module
 */
import { fold } from '../../types/list/module.f.ts'
import { reset, fgGreen, fgRed, bold, type CsiConsole, stdio, stderr } from '../../text/sgr/module.f.ts'
import type * as Result from '../../types/result/module.f.ts'
import type { Io, Performance, TryCatch } from '../../io/module.f.ts'
import { env, loadModuleMap, type ModuleMap, type Module } from '../module.f.ts'

type DependencyMap = {
   readonly[k in string]?: Module
}

type Log<T> = CsiConsole

type Measure<T> = <R>(f: () => R) => (state: T) => readonly[R, number, T]

type Input<T> = {
    readonly moduleMap: ModuleMap,
    readonly log: Log<T>,
    readonly error: Log<T>,
    readonly measure: Measure<T>,
    readonly state: T,
    readonly tryCatch: <R>(f: () => R) => Result.Result<R, unknown>,
    readonly env: (n: string) => string|undefined
 }

export const isTest = (s: string): boolean => s.endsWith('test.f.js') || s.endsWith('test.f.ts')

type TestState = {
    readonly time: number,
    readonly pass: number,
    readonly fail: number,
 }

const addPass = (delta: number) => (ts: TestState): TestState =>
    ({ ...ts, time: ts.time + delta, pass: ts.pass + 1 })

const addFail = (delta: number) => (ts: TestState): TestState =>
    ({ ...ts, time: ts.time + delta, fail: ts.fail + 1 })

type FullState<T> = readonly[TestState, T]

const timeFormat = (a: number) => {
    const y = Math.round(a * 10_000).toString()
    const yl = 5 - y.length
    const x = '0'.repeat(yl > 0 ? yl : 0) + y
    const s = x.length - 4
    const b = x.substring(0, s)
    const e = x.substring(s)
    return `${b}.${e} ms`
}

export type Test = () => unknown

export type TestSet = Test | readonly(readonly[string, unknown])[]

export const parseTestSet = (t: TryCatch) => (throws: boolean) => (x: unknown): TestSet => {
    switch (typeof x) {
        case 'function': {
            if (x.length === 0) {
                const xt = x as Test
                if (!throws && xt.name !== 'throw') {
                    return xt
                }
                // Pass-on-throw: the test passes if it throws. Triggered when the
                // enclosing tree node is named 'throw' (so any function reference
                // works, not only inline ones whose inferred name is 'throw').
                return () => {
                    const [tag, value] = t(xt)
                    if (tag === 'ok') {
                        throw value
                    }
                    return value
                }
            }
            break
        }
        case 'object': {
            if (x !== null) {
                return Object.entries(x)
            }
            break
        }
    }
    return []
}

export const test = <T>(input: Input<T>): readonly[number, T] => {
    let { moduleMap, log, error, measure, tryCatch, env, state } = input
    const isGitHub = env('GITHUB_ACTION') !== undefined
    const parse = parseTestSet(tryCatch)
    const f
        : (k: readonly[string, Module]) => (fs: FullState<T>) => FullState<T>
        = ([k, v]) => {
        const test
            : (i: string) => (throws: boolean) => (v: unknown) => (fs: FullState<T>) => FullState<T>
            = i => throws => v => ([ts, state]) => {
            const next = test(`${i}| `)

            const set = parse(throws)(v)
            if (typeof set === 'function') {
                const [[s, r], delta, state0] = measure(() => tryCatch(set))(state)
                state = state0
                if (s !== 'ok') {
                    ts = addFail(delta)(ts)
                    if (isGitHub) {
                        // https://docs.github.com/en/actions/learn-github-actions/workflow-commands-for-github-actions
                        // https://github.com/OndraM/ci-detector/blob/main/src/Ci/GitHubActions.php
                        error(`::error file=${k},line=1,title=${i}()::${r}`)
                    } else {
                        error(`${i}() ${fgRed}error${reset}, ${timeFormat(delta)}`)
                        error(`${fgRed}${r}${reset}`)
                    }
                } else {
                    ts = addPass(delta)(ts)
                    log(`${i}() ${fgGreen}ok${reset}, ${timeFormat(delta)}`);
                    // The result of a function is walked as a fresh sub-tree;
                    // the parent's `throws` flag does not propagate into it.
                    [ts, state] = next(false)(r)([ts, state])
                }
            } else {
                const f
                    : (k: readonly[string|number, unknown]) => (fs: FullState<T>) => FullState<T>
                    = ([k, v]) => ([time, state]) => {
                    log(`${i}${k}:`);
                    [time, state] = next(throws || k === 'throw')(v)([time, state])
                    return [time, state]
                }
                [ts, state] = fold(f)([ts, state])(set)
            }
            return [ts, state]
        }
        return ([ts, state]) => {
            if (isTest(k)) {
                log(`testing ${k}`);
                [ts, state] = test('| ')(false)(v.default)([ts, state])
                // Non-default exports are walked as a sibling test group so
                // a test file can spread its tests across multiple named
                // exports (see issue 27 in `issues/README.md`). Skip exports
                // that parseTestSet would treat as empty (constants, types,
                // non-test helpers) to avoid noisy empty entries in output.
                const others = Object.fromEntries(
                    Object.entries(v).filter(([key, val]) =>
                        key !== 'default' && (
                            (typeof val === 'function' && (val as Function).length === 0) ||
                            (typeof val === 'object' && val !== null)
                        )
                    )
                )
                if (Object.keys(others).length !== 0) {
                    [ts, state] = test('| ')(false)(others)([ts, state])
                }
            }
            return [ts, state]
        }
    }
    let ts
        : TestState
        = { time: 0, pass: 0, fail: 0 };
    [ts, state] = fold(f)([ts, state])(Object.entries(moduleMap))
    const fgFail = ts.fail === 0 ? fgGreen : fgRed
    log(`${bold}Number of tests: pass: ${fgGreen}${ts.pass}${reset}${bold}, fail: ${fgFail}${ts.fail}${reset}${bold}, total: ${ts.pass + ts.fail}${reset}`)
    log(`${bold}Time: ${timeFormat(ts.time)}${reset}`)
    return [ts.fail !== 0 ? 1 : 0, state]
}

export const anyLog = (f: (s: string) => void) => (s: string) => <T>(state: T): T => {
    f(s)
    return state
}

export const measure = (p: Performance) => <R>(f: () => R) => <T>(state: T): readonly[R, number, T] => {
    const b = p.now()
    const r = f()
    const e = p.now()
    return [r, e - b, state]
}

export const main = async(io: Io): Promise<number> => test({
    moduleMap: await loadModuleMap(io),
    log: stdio(io), // anyLog(io.console.log),
    error: stderr(io), // anyLog(io.console.error),
    measure: measure(io.performance),
    tryCatch: io.tryCatch,
    env: env(io),
    state: undefined,
})[0]
