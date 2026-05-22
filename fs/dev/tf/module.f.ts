/**
 * Test-framework helpers for running and reporting FunctionalScript tests.
 *
 * @module
 */
import { reset, fgGreen, fgRed, bold, csiWrite } from '../../text/sgr/module.f.ts'
import { sandbox, type NodeOp, type NodeProgramOptions } from '../../types/effects/node/module.f.ts'
import { pure, type Effect } from '../../types/effects/module.f.ts'
import { loadModuleMap2, type Module } from '../module.f.ts'

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
                const fn = x as Test
                return { fn, throws: throws || fn.name === 'throw' }
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

const test = (options: NodeProgramOptions): Effect<NodeOp, number> => {
    const isGitHub = options.env['GITHUB_ACTION'] !== undefined
    const csiLog = (s: string) => csiWrite(options)('stdout')(s + '\n')
    const csiError = (s: string) => csiWrite(options)('stderr')(s + '\n')

    return loadModuleMap2(options.env).step(moduleMap => {
        const walk
            : (k: string) => (i: string) => (throws: boolean) => (v: unknown) => (ts: TestState) => Effect<NodeOp, TestState>
            = k => i => throws => v => ts => {
            const next = walk(k)(`${i}| `)
            const set = parseTestSet(throws)(v)
            if (set instanceof Array) {
                return set.reduce(
                    (acc: Effect<NodeOp, TestState>, [ck, cv]) =>
                        acc.step(ts => csiLog(`${i}${ck}:`).step(() => next(throws || ck === 'throw')(cv)(ts))),
                    pure(ts) as Effect<NodeOp, TestState>
                )
            }
            return sandbox(set.fn).step(({ result: [s, r], duration }) => {
                const { throws } = set
                if (throws !== (s === 'ok')) {
                    return csiLog(`${i}() ${fgGreen}ok${reset}, ${timeFormat(duration)}`).step(() => {
                        const ts2 = addPass(duration)(ts)
                        // The result of a function is walked as a fresh sub-tree;
                        // the parent's `throws` flag does not propagate into it.
                        if (!throws) { return next(false)(r)(ts2) }
                        return pure(ts2) as Effect<NodeOp, TestState>
                    })
                }
                const ts2 = addFail(duration)(ts)
                if (isGitHub) {
                    // https://docs.github.com/en/actions/learn-github-actions/workflow-commands-for-github-actions
                    // https://github.com/OndraM/ci-detector/blob/main/src/Ci/GitHubActions.php
                    return csiError(`::error file=${k},line=1,title=${i}()::${r}`).step(() =>
                        pure(ts2) as Effect<NodeOp, TestState>
                    )
                }
                return csiError(`${i}() ${fgRed}error${reset}, ${timeFormat(duration)}`).step(() =>
                    csiError(`${fgRed}${r}${reset}`).step(() => pure(ts2) as Effect<NodeOp, TestState>)
                )
            })
        }
        const entries: readonly[string, Module][] = Object.entries(moduleMap)
        return entries.reduce(
            (acc: Effect<NodeOp, TestState>, [k, v]) =>
                acc.step(ts => {
                    if (!isTest(k)) { return pure(ts) as Effect<NodeOp, TestState> }
                    return csiLog(`testing ${k}`).step(() =>
                        walk(k)('| ')(false)(v.default)(ts).step(ts => {
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
                                return walk(k)('| ')(false)(others)(ts)
                            }
                            return pure(ts) as Effect<NodeOp, TestState>
                        })
                    )
                }),
            pure({ time: 0, pass: 0, fail: 0 }) as Effect<NodeOp, TestState>
        ).step(ts => {
            const fgFail = ts.fail === 0 ? fgGreen : fgRed
            return csiLog(`${bold}Number of tests: pass: ${fgGreen}${ts.pass}${reset}${bold}, fail: ${fgFail}${ts.fail}${reset}${bold}, total: ${ts.pass + ts.fail}${reset}`).step(() =>
                csiLog(`${bold}Time: ${timeFormat(ts.time)}${reset}`).step(() =>
                    pure(ts.fail !== 0 ? 1 : 0) as Effect<NodeOp, number>
                )
            )
        })
    })
}

export const main = test
