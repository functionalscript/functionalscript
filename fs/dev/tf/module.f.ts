/**
 * Test-framework helpers for running and reporting FunctionalScript tests.
 *
 * @module
 */
import { fold } from '../../types/list/module.f.ts'
import { reset, fgGreen, fgRed, bold, stdio, stderr } from '../../text/sgr/module.f.ts'
import type { Io } from '../../io/module.f.ts'
import { env, loadModuleMap, type Module } from '../module.f.ts'

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

export type TestEntry = {
    readonly fn: Test
    readonly throws: boolean
}

export type TestSet = TestEntry | readonly(readonly[string, unknown])[]

export const parseTestSet = (throws: boolean) => (x: unknown): TestSet => {
    switch (typeof x) {
        case 'function': {
            if (x.length === 0) {
                const xt = x as Test
                return { fn: xt, throws: throws || xt.name === 'throw' }
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

const test = async(io: Io): Promise<number> => {
    const moduleMap = await loadModuleMap(io)
    const log = stdio(io)
    const error = stderr(io)
    const { sandbox } = io
    const env_ = env(io)
    const isGitHub = env_('GITHUB_ACTION') !== undefined
    const f
        : (k: readonly[string, Module]) => (ts: TestState) => TestState
        = ([k, v]) => {
        const test
            : (i: string) => (throws: boolean) => (v: unknown) => (ts: TestState) => TestState
            = i => throws => v => ts => {
            const next = test(`${i}| `)

            const set = parseTestSet(throws)(v)
            if (set instanceof Array) {
                const f
                    : (k: readonly[string|number, unknown]) => (ts: TestState) => TestState
                    = ([k, v]) => ts => {
                    log(`${i}${k}:`);
                    ts = next(throws || k === 'throw')(v)(ts)
                    return ts
                }
                ts = fold(f)(ts)(set)
            } else {
                const { result: [s, r], duration } = sandbox(set.fn)
                const passed = set.throws ? s === 'error' : s === 'ok'
                if (!passed) {
                    ts = addFail(duration)(ts)
                    if (isGitHub) {
                        // https://docs.github.com/en/actions/learn-github-actions/workflow-commands-for-github-actions
                        // https://github.com/OndraM/ci-detector/blob/main/src/Ci/GitHubActions.php
                        error(`::error file=${k},line=1,title=${i}()::${r}`)
                    } else {
                        error(`${i}() ${fgRed}error${reset}, ${timeFormat(duration)}`)
                        error(`${fgRed}${r}${reset}`)
                    }
                } else {
                    ts = addPass(duration)(ts)
                    log(`${i}() ${fgGreen}ok${reset}, ${timeFormat(duration)}`);
                    // The result of a function is walked as a fresh sub-tree;
                    // the parent's `throws` flag does not propagate into it.
                    if (!set.throws) { ts = next(false)(r)(ts) }
                }
            }
            return ts
        }
        return ts => {
            if (isTest(k)) {
                log(`testing ${k}`);
                ts = test('| ')(false)(v.default)(ts)
                // Non-default exports are walked as a sibling test group so
                // a test file can spread its tests across multiple named
                // exports (see issue 27 in `issues/README.md`). Skip exports
                // that parseTestSet would treat as empty (constants, types,
                // non-test helpers) to avoid noisy empty entries in output.
                const others = Object.fromEntries(
                    Object.entries(v).filter(([key, val]) =>
                        key !== 'default' && (
                            (typeof val === 'function' && val.length === 0) ||
                            (typeof val === 'object' && val !== null)
                        )
                    )
                )
                if (Object.keys(others).length !== 0) {
                    ts = test('| ')(false)(others)(ts)
                }
            }
            return ts
        }
    }
    let ts: TestState = { time: 0, pass: 0, fail: 0 }
    ts = fold(f)(ts)(Object.entries(moduleMap))
    const fgFail = ts.fail === 0 ? fgGreen : fgRed
    log(`${bold}Number of tests: pass: ${fgGreen}${ts.pass}${reset}${bold}, fail: ${fgFail}${ts.fail}${reset}${bold}, total: ${ts.pass + ts.fail}${reset}`)
    log(`${bold}Time: ${timeFormat(ts.time)}${reset}`)
    return ts.fail !== 0 ? 1 : 0
}

export const main = test
