import { io } from '../../io/module.ts'
import { loadModuleMap2 } from '../module.f.ts'
import { isTest, parseTestSet } from './module.f.ts'
import * as nodeTest from 'node:test'
import { asyncImport } from '../../io/module.ts'
import { fromIo } from '../../io/module.f.ts'

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
        const set = parseTestSet(throws)(value)
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

export const run = async(): Promise<void> => {
    const x = await fromIo(io)(loadModuleMap2(io.process.env))
    for (const [i, v] of Object.entries(x)) {
        if (isTest(i)) {
            framework(i, scanModule(['', v.default, false]))
        }
    }
}


