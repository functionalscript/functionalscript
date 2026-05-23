/**
 * Test-framework helpers for running and reporting FunctionalScript tests.
 *
 * @module
 */
import { reset, fgGreen, fgRed, bold, csiWrite } from '../../text/sgr/module.f.ts'
import { sandbox, type NodeOp, type NodeProgram, type NodeProgramOptions, type Program, type Sandbox, type Write } from '../../types/effects/node/module.f.ts'
import { pure, type Effect, type Operation } from '../../types/effects/module.f.ts'
import { loadModuleMap, type LoadModuleOperations, type Module, type ModuleMap } from '../module.f.ts'

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
export type Reporter<O extends Operation> = {
    readonly moduleStart: (file: string) => Effect<O, void>
    readonly enter: (path: readonly string[]) => Effect<O, void>
    readonly pass: (path: readonly string[], duration: number) => Effect<O, void>
    readonly fail: (file: string, path: readonly string[], result: unknown, duration: number) => Effect<O, void>
    readonly summary: (pass: number, fail: number, time: number) => Effect<O, void>
}

const runModuleMap = <O extends Operation>({ moduleStart, enter, pass, fail, summary }: Reporter<O>) => (moduleMap: ModuleMap): Effect<O|Sandbox, number> => {
    const walk
        : (k: string) => (path: readonly string[]) => (throws: boolean) => (v: unknown) => (ts: TestState) => Effect<O|Sandbox, TestState>
        = k => path => throws => v => ts =>
    {
        const set = parseTestSet(throws)(v)
        if (set instanceof Array) {
            return set.reduce(
                (acc: Effect<O|Sandbox, TestState>, [ck, cv]) => {
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
    const entries = Object.entries(moduleMap)
    return entries.reduce(
        (acc: Effect<O|Sandbox, TestState>, [k, v]) =>
            acc.step(ts => {
                if (!isTest(k)) { return pure(ts) }
                return moduleStart(k).step(() => walk(k)([])(false)(v)(ts))
            }),
        pure({ time: 0, pass: 0, fail: 0 })
    ).step(ts => summary(ts.pass, ts.fail, ts.time).step(() => pure(ts.fail !== 0 ? 1 : 0)))
}

export const test = <O extends Operation>(reporter: Reporter<O>): Program<O|LoadModuleOperations|Sandbox> => options =>
    loadModuleMap(options.env).step(runModuleMap(reporter))

const isAlpha = (c: string): boolean =>
    (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_' || c === '$'
const isDigit = (c: string): boolean => c >= '0' && c <= '9'

export const isInteger = (s: string): boolean =>
    s.length > 0 && [...s].every(isDigit) && (s === '0' || s[0] !== '0')
export const isIdentifier = (s: string): boolean =>
    s.length > 0 && isAlpha(s[0]) && [...s.slice(1)].every(c => isAlpha(c) || isDigit(c))

/**
 * Renders a key chain as a JS object path: integer-like keys become numbers,
 * other strings are JSON-stringified. E.g. `['math', 'add']` → `["math","add"]`,
 * `['users', '3', 'name']` → `["users",3,"name"]`. Used for the GitHub
 * annotation `title=` field where the full unambiguous path is desired.
 */
export const fmtPath = (path: readonly string[]): string =>
    JSON.stringify(path.map(k => isInteger(k) ? Number(k) : k))

/**
 * Renders a key chain for terminal output: `| ` per level of depth, followed
 * by the last segment formatted as a bare integer, a bare identifier, or a
 * JSON-quoted string. E.g. `['math', 'add']` → `| | add`,
 * `['a', '0']` → `| | 0`, `['x', 'hello world']` → `| | "hello world"`.
 */
export const fmtTerm = (path: readonly string[]): string => {
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
export const ghEscape = (s: string): string =>
    s.replaceAll('%', '%25')
        .replaceAll(':', '%3A')
        .replaceAll(',', '%2C')
        .replaceAll('\r', '%0D')
        .replaceAll('\n', '%0A')

/**
 * The terminal/GitHub reporter used by `fjs t`. Output goes through
 * `csiWrite`, so ANSI styles are stripped on non-TTY streams. When
 * `GITHUB_ACTION` is set, failures are emitted as `::error` workflow
 * annotations instead of colored lines. Exported as a factory so the
 * GitHub format path can be exercised directly from tests.
 */
export const defaultReporter = (options: NodeProgramOptions): Reporter<Write> => {
    const csiLog = (s: string) => csiWrite(options)('stdout')(s + '\n')
    const csiError = (s: string) => csiWrite(options)('stderr')(s + '\n')
    const isGitHub = options.env['GITHUB_ACTION'] !== undefined
    return {
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
}

export const main: NodeProgram = options => test(defaultReporter(options))(options)
