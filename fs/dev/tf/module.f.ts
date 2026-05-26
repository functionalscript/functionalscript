/**
 * Test-framework helpers for running and reporting FunctionalScript tests.
 *
 * @module
 */
import { reset, fgGreen, fgRed, bold, csiWrite } from '../../text/sgr/module.f.ts'
import {
    sandbox,
    type NodeProgram,
    type NodeProgramOptions,
    type Program,
    type Sandbox,
    type SandboxResult,
    type Write,
    type WriteConsoles
} from '../../types/effects/node/module.f.ts'
import { pure, type Effect, type Operation } from '../../types/effects/module.f.ts'
import { loadModuleMap, type LoadModuleOperations, type ModuleMap } from '../module.f.ts'
import { invert } from '../../types/result/module.f.ts'

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

export type TestSet = TestEntry | readonly (readonly [string, unknown])[]

export const parseTestSet = (throws: boolean, x: unknown): TestSet => {
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
 * Recursively collects all leaf tests reachable from `v` as `[path, entry]`
 * pairs, without running anything. Return-value sub-trees are not walked
 * (that requires execution); only the static object/array/function structure
 * is traversed.
 */
export const collectTests = (
    path: Path,
    throws: boolean,
    v: unknown,
): readonly (readonly [Path, TestEntry])[] => {
    const set = parseTestSet(throws, v)
    if (set instanceof Array) {
        return set.flatMap(([ck, cv]) =>
            collectTests([...path, ck], throws || ck === 'throw', cv)
        )
    }
    return [[path, set]]
}

/**
 * Receives semantic test-run events. Each method is the runner's notification
 * of an event; the reporter decides how to render it (terminal, GitHub
 * annotations, JSON, node `--test`, etc.). `path` is the chain of object keys
 * leading to the current location; `null` marks a function-call boundary, e.g.
 * `['outer', null, 'inner']` means `outer` was invoked and its return value
 * contained `inner`.
 */
export type Reporter<O extends Operation> = {
    readonly moduleStart: (file: string) => Effect<O, void>
    readonly enter: (path: Path) => Effect<O, void>
    readonly result: (file: string, path: Path, r: SandboxResult<unknown>) => Effect<O, void>
    readonly summary: (pass: number, fail: number, time: number) => Effect<O, void>
    readonly test: (file: string,path: Path, set: TestEntry) => Effect<O, SandboxResult<unknown>>
}

const runModule =
    <O extends Operation>({ moduleStart, enter, result, test }: Reporter<O>) =>
    (k: string, v: unknown) =>
    (ts: TestState): Effect<O, TestState> =>
{
    const walk =
        (path: Path, oldThrows: boolean, v: unknown) =>
        (ts: TestState): Effect<O, TestState> =>
    {
        const set = parseTestSet(oldThrows, v)
        if (set instanceof Array) {
            return set.reduce(
                (acc: Effect<O, TestState>, [ck, cv]) => {
                    const sub = [...path, ck]
                    const recurse = walk(sub, oldThrows || ck === 'throw', cv)
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
        return test(k, path, set).step(sr => {
            const { result: [s, r], duration } = sr
            return result(k, path, sr).step(() => {
                if (s === 'ok') {
                    // Only non-throw tests walk their return value as a fresh sub-tree;
                    // thrown values are discarded. `null` marks the call boundary so
                    // paths render as e.g. `outer().inner()`. `throws` resets to false.
                    const cont = set.throws ? pure : walk([...path, null], false, r)
                    return cont(addPass(duration)(ts))
                }
                return pure(addFail(duration)(ts))
            })
        })
    }
    return moduleStart(k).step(() => walk([], false, v)(ts))
}

const { entries } = Object

export const runModuleMap = <O extends Operation>(reporter: Reporter<O>) => (moduleMap: ModuleMap): Effect<O, number> => {
    const { summary } = reporter
    const modules = entries(moduleMap).filter(([k]) => isTest(k))
    return modules.reduce(
        (acc: Effect<O, TestState>, [k, v]) => acc.step(runModule(reporter)(k, v)),
        pure({ time: 0, pass: 0, fail: 0 })
    )
    .step(ts => summary(ts.pass, ts.fail, ts.time)
    .step(() => pure(ts.fail !== 0 ? 1 : 0)))
}

export const test = <O extends Operation>(reporter: Reporter<O>): Program<O | LoadModuleOperations> => options =>
    loadModuleMap(options.env).step(runModuleMap(reporter))

export type Path = readonly (string | null)[]

const isAlpha = (c: string): boolean =>
    (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_' || c === '$'

const isDigit = (c: string): boolean => c >= '0' && c <= '9'

export const isInteger = (s: string): boolean =>
    s.length > 0 && [...s].every(isDigit) && (s === '0' || s[0] !== '0')

export const isIdentifier = (s: string): boolean =>
    s.length > 0 && isAlpha(s[0]) && [...s.slice(1)].every(c => isAlpha(c) || isDigit(c))

const fmtKey = (k: string | null): string =>
    k === null ? '()'
    : isInteger(k) ? `[${k}]`
    : isIdentifier(k) ? `.${k}`
    : `[${JSON.stringify(k)}]`

/**
 * Renders a key chain as a JS property-access expression: identifier keys use
 * dot notation, integer keys use `[N]`, other strings use `["key"]`, and `null`
 * emits `()` to mark a function-call boundary.
 * E.g. `['math', 'add']` → `.math.add`, `['outer', null, 'inner']` → `.outer().inner`.
 */
export const fmtPath = (path: Path): string =>
    path.reduce((acc: string, k) => acc + fmtKey(k), '')

/**
 * Formats a fully-qualified test identifier as a JS-like expression, e.g.
 * `import("./math.test.f.ts").add()` or `import("./a.test.f.ts").users[3].name()`.
 * Self-contained per line — suitable for parallel output and as a CLI filter argument.
 */
export const fmtImport = (file: string, path: Path): string =>
    `import(${JSON.stringify(file)})${fmtPath(path)}()`

/**
 * Renders a key chain for terminal output: `| ` per level of depth, followed
 * by the last segment formatted as a bare integer, a bare identifier, or a
 * JSON-quoted string. E.g. `['math', 'add']` → `| | add`,
 * `['a', '0']` → `| | 0`, `['x', 'hello world']` → `| | "hello world"`.
 */
export const fmtTerm = (path: Path): string => {
    const keys = path.flatMap(k => k !== null ? [k] : [])
    const indent = '| '.repeat(keys.length)
    if (keys.length === 0) { return `${indent}()` }
    const last = keys[keys.length - 1]
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

export const defaultTest = (file: string, path: Path, { fn, throws }: TestEntry): Effect<Sandbox, SandboxResult<unknown>> =>
    sandbox(fn)
    .step(r => pure(throws ? { ...r, result: invert(r.result) } : r))

const fmtResultLine = (file: string, path: Path, color: string, label: string, duration: number): string =>
    `${fmtImport(file, path)}: ${color}${label}${reset}, ${timeFormat(duration)}`

/**
 * The terminal/GitHub reporter used by `fjs t`. Output goes through
 * `csiWrite`, so ANSI styles are stripped on non-TTY streams. When
 * `GITHUB_ACTION` is set, failures are emitted as `::error` workflow
 * annotations instead of colored lines. Exported as a factory so the
 * GitHub format path can be exercised directly from tests.
 */
export const defaultReporter = (options: NodeProgramOptions): Reporter<Write|Sandbox> => {
    const write = csiWrite(options)
    const line = (w: WriteConsoles) => {
        const x = write(w)
        return (s: string) => x(s + '\n')
    }
    const csiLog = line('stdout')
    const csiError = line('stderr')
    const isGitHub = options.env['GITHUB_ACTION'] !== undefined
    return {
        moduleStart: _file => pure(undefined),
        enter: _path => pure(undefined),
        // https://github.com/OndraM/ci-detector/blob/main/src/Ci/GitHubActions.php
        result: (file, path, { result: [s, v], duration }) =>
            s === 'ok'
                ? csiLog(fmtResultLine(file, path, fgGreen, 'ok', duration))
                : isGitHub
                    ? csiError(`::error file=${file},line=1,title=${ghEscape(fmtImport(file, path))}::${ghEscape(String(v))}`)
                    : csiError(fmtResultLine(file, path, fgRed, 'error', duration))
                        .step(() => csiError(`${fgRed}${v}${reset}`)),
        summary: (pass, fail, time) => {
            const fgFail = fail === 0 ? fgGreen : fgRed
            return csiLog(`${bold}Number of tests: pass: ${fgGreen}${pass}${reset}${bold}, fail: ${fgFail}${fail}${reset}${bold}, total: ${pass + fail}${reset}`)
                .step(() => csiLog(`${bold}Time: ${timeFormat(time)}${reset}`))
        },
        test: defaultTest,
    }
}

export const main: NodeProgram =
    options => test(defaultReporter(options))(options)
