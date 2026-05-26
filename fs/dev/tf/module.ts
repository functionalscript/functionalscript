import { io, tryCatch } from '../../io/module.ts'
import { loadModuleMap } from '../module.f.ts'
import { fmtImport, isTest, parseTestSet, runModuleMap, type Reporter } from './module.f.ts'
import * as nodeTest from 'node:test'
import { asyncImport } from '../../io/module.ts'
import { fromIo } from '../../io/module.f.ts'
import { pure, type ToAsyncOperationMap } from '../../types/effects/module.f.ts'
import { asyncRun } from '../../types/effects/module.ts'
import { type All } from '../../types/effects/node/module.f.ts'

//

declare const Bun: object | undefined

const isBun = typeof Bun !== 'undefined'

const isPlaywright = typeof process !== 'undefined' && process?.env?.PLAYWRIGHT_TEST !== undefined

//

type Awaitable<T> = Promise<T> | T

type SubTestRunnerFunc = (name: string, f: () => Awaitable<void>) => Awaitable<void>

type Test = readonly[string, unknown, boolean]

type TestFunc = (f: SubTestRunnerFunc) => Awaitable<void>

type CommonFramework = (name: string, f: TestFunc) => Awaitable<void>

const createFramework = (fw: typeof nodeTest): CommonFramework =>
    (prefix, f) => fw.test(prefix, t => f((name, v) => t.test(name, v)))

// Bun doesn't support nested tests yet.
const createBunFramework = (fw: typeof nodeTest): CommonFramework =>
    (prefix, f) => f((name, v) => fw.test(`${prefix}: ${name}`, v))

const createPlaywrightFramework = async (): Promise<CommonFramework> => {
    const pwTest = (await asyncImport('@playwright/test') as any).test
    return (prefix, f) => f((name, v) => pwTest(`${prefix}: ${name}`, v))
}

const framework: CommonFramework =
    isPlaywright ? await createPlaywrightFramework() :
    isBun ? createBunFramework(nodeTest) :
        createFramework(nodeTest)

const scanModule = (x: Test): TestFunc => async(subTestRunner: SubTestRunnerFunc) => {
    let subTests = [x]
    while (true) {
        const [first, ...rest] = subTests
        if (first === undefined) {
            break
        }
        subTests = rest
        //
        const [name, value, throws] = first
        const set = parseTestSet(throws, value)
        if (set instanceof Array) {
            for (const [j, y] of set) {
                const pr = `${name}/${j}`
                subTests = [...subTests, [pr, y, throws || j === 'throw']]
            }
        } else {
            await subTestRunner(name, () => {
                if (set.throws) {
                    let threw = false
                    try { set.fn() } catch (_) { threw = true }
                    if (!threw) { throw new Error(`${name}() expected to throw`) }
                } else {
                    const r = set.fn()
                    // The result of a function is walked as a fresh sub-tree;
                    // the parent's `throws` flag does not propagate into it.
                    subTests = [...subTests, [`${name}()`, r, false]]
                }
            })
        }
    }
}

const noOp = () => pure(undefined)

const reporter: Reporter<never> = {
    result: noOp,
    summary: noOp,
    test: (file, path, { throws, fn }) => {
        nodeTest.test(fmtImport(file, path), async _t => {
            const [s, r] = tryCatch(fn)
            if (throws === (s === 'ok')) {
                throw r
            }
            if (!throws) {
                // add subtests
            }
        })
        return pure({
            result: ['ok', undefined],
            duration: 0,
        })
    }
}

const map: ToAsyncOperationMap<All> = {
    // TODO: we use the same algorithm twice. Refactor by creating a `createAll(map)`
    // helper that takes a `map` and returns an `all` function that runs effects
    // according to the map. There could be a problem with circular dependencies,
    // but we can use a lazy function `() => ToAsyncOperationMap<All>` instead od `map`.
    all: async (...effects) => Promise.all(effects.map(asyncRun(map))),
}

export const run = async(): Promise<void> => {
    const fio = fromIo(io)
    const moduleMap = await fio(loadModuleMap(io.process.env))
    const runner = runModuleMap(reporter)(moduleMap)
    await asyncRun(map)(runner)
}

export const run3 = async(): Promise<void> => {
    const moduleMap = await fromIo(io)(loadModuleMap(io.process.env))
    for (const [i, v] of Object.entries(moduleMap)) {
        if (isTest(i)) {
            framework(i, scanModule(['', v, false]))
        }
    }
}
