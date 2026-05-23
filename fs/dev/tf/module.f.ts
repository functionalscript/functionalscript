/**
 * Test-framework helpers for running and reporting FunctionalScript tests.
 *
 * @module
 */
import { reset, fgGreen, fgRed, bold, csiWrite } from '../../text/sgr/module.f.ts'
import { sandbox, type NodeOp, type NodeProgram } from '../../types/effects/node/module.f.ts'
import { pure, type Effect } from '../../types/effects/module.f.ts'
import { loadModuleMap, type Module } from '../module.f.ts'

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

/**
 * Receives semantic test-run events. Each method is the runner's notification
 * of an event; the reporter decides how to render it (terminal, GitHub
 * annotations, JSON, node `--test`, etc.). `path` is the chain of object keys
 * leading to the current location, e.g. `['math', 'add']`.
 */
export type Reporter = {
    readonly moduleStart: (file: string) => Effect<NodeOp, void>
    readonly enter: (path: readonly string[]) => Effect<NodeOp, void>
    readonly pass: (path: readonly string[], duration: number) => Effect<NodeOp, void>
    readonly fail: (file: string, path: readonly string[], result: unknown, duration: number) => Effect<NodeOp, void>
    readonly summary: (pass: number, fail: number, time: number) => Effect<NodeOp, void>
}

export const test = ({ moduleStart, enter, pass, fail, summary }: Reporter): NodeProgram => options =>
    loadModuleMap(options.env).step(moduleMap => {
        const walk
            : (k: string) => (path: readonly string[]) => (throws: boolean) => (v: unknown) => (ts: TestState) => Effect<NodeOp, TestState>
            = k => path => throws => v => ts => {
            const set = parseTestSet(throws)(v)
            if (set instanceof Array) {
                return set.reduce(
                    (acc: Effect<NodeOp, TestState>, [ck, cv]) => {
                        const sub = [...path, ck]
                        const recurse = walk(k)(sub)(throws || ck === 'throw')(cv)
                        // Emit `enter` only for sub-tree values (objects/arrays). Leaf
                        // values (functions, primitives) skip `enter` so the reporter
                        // can combine the key with the pass/fail line.
                        return typeof cv === 'object' && cv !== null
                            ? acc.step(ts => enter(sub).step(() => recurse(ts)))
                            : acc.step(recurse)
                    },
                    pure(ts)
                )
            }
            return sandbox(set.fn).step(({ result: [s, r], duration }) => {
                const { throws } = set
                if (throws !== (s === 'ok')) {
                    return pass(path, duration).step(() => {
                        const ts2 = addPass(duration)(ts)
                        // Only non-throw tests walk their return value as a fresh sub-tree;
                        // thrown values are discarded. The sub-tree's `throws` resets to false.
                        if (!throws) { return walk(k)(path)(false)(r)(ts2) }
                        return pure(ts2)
                    })
                }
                const ts2 = addFail(duration)(ts)
                return fail(k, path, r, duration).step(() => pure(ts2))
            })
        }
        const entries: readonly[string, Module][] = Object.entries(moduleMap)
        return entries.reduce(
            (acc: Effect<NodeOp, TestState>, [k, v]) =>
                acc.step(ts => {
                    if (!isTest(k)) { return pure(ts) as Effect<NodeOp, TestState> }
                    return moduleStart(k).step(() =>
                        walk(k)([])(false)(v.default)(ts).step(ts => {
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
                                return walk(k)([])(false)(others)(ts)
                            }
                            return pure(ts)
                        })
                    )
                }),
            pure({ time: 0, pass: 0, fail: 0 })
        ).step(ts => summary(ts.pass, ts.fail, ts.time).step(() => pure(ts.fail !== 0 ? 1 : 0)))
    })

const isInteger = (s: string): boolean => /^(?:0|[1-9]\d*)$/.test(s)
const isIdentifier = (s: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s)

/**
 * Renders a key chain as a JS object path: integer-like keys become numbers,
 * other strings are JSON-stringified. E.g. `['math', 'add']` → `["math","add"]`,
 * `['users', '3', 'name']` → `["users",3,"name"]`. Used for the GitHub
 * annotation `title=` field where the full unambiguous path is desired.
 */
const fmtPath = (path: readonly string[]): string =>
    JSON.stringify(path.map(k => isInteger(k) ? Number(k) : k))

/**
 * Renders a key chain for terminal output: `| ` per level of depth, followed
 * by the last segment formatted as a bare integer, a bare identifier, or a
 * JSON-quoted string. E.g. `['math', 'add']` → `| | add`,
 * `['a', '0']` → `| | 0`, `['x', 'hello world']` → `| | "hello world"`.
 */
const fmtTerm = (path: readonly string[]): string => {
    const indent = '| '.repeat(path.length)
    if (path.length === 0) { return `${indent}()` }
    const last = path[path.length - 1]
    return `${indent}${isInteger(last) || isIdentifier(last) ? last : JSON.stringify(last)}`
}

/**
 * Percent-encodes characters that GitHub workflow-command property values
 * treat as separators (`%`, `:`, `,`) plus newlines.
 * https://docs.github.com/en/actions/learn-github-actions/workflow-commands-for-github-actions
 */
const ghEscape = (s: string): string =>
    s.replace(/%/g, '%25')
        .replace(/:/g, '%3A')
        .replace(/,/g, '%2C')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')

export const main: NodeProgram = options => {
    const csiLog = (s: string) => csiWrite(options)('stdout')(s + '\n')
    const csiError = (s: string) => csiWrite(options)('stderr')(s + '\n')
    const isGitHub = options.env['GITHUB_ACTION'] !== undefined
    const reporter: Reporter = {
        moduleStart: file => csiLog(`testing ${file}`),
        enter: path => csiLog(`${fmtTerm(path)}:`),
        pass: (path, duration) => csiLog(`${fmtTerm(path)}: ${fgGreen}ok${reset}, ${timeFormat(duration)}`),
        fail: isGitHub
            // https://github.com/OndraM/ci-detector/blob/main/src/Ci/GitHubActions.php
            ? (file, path, result, _duration) =>
                csiError(`::error file=${file},line=1,title=${ghEscape(fmtPath(path))}::${ghEscape(String(result))}`)
            : (_file, path, result, duration) =>
                csiError(`${fmtTerm(path)}: ${fgRed}error${reset}, ${timeFormat(duration)}`).step(() =>
                    csiError(`${fgRed}${result}${reset}`)
                ),
        summary: (pass, fail, time) => {
            const fgFail = fail === 0 ? fgGreen : fgRed
            return csiLog(`${bold}Number of tests: pass: ${fgGreen}${pass}${reset}${bold}, fail: ${fgFail}${fail}${reset}${bold}, total: ${pass + fail}${reset}`).step(() =>
                csiLog(`${bold}Time: ${timeFormat(time)}${reset}`)
            )
        }
    }
    return test(reporter)(options)
}
