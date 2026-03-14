import { io } from '../../io/module.ts'
import { loadModuleMap } from '../module.f.ts'
import { isTest, parseTestSet } from './module.f.ts'
import * as nodeTest from 'node:test'

//

declare const Bun: object | undefined

const isBun = typeof Bun !== 'undefined'

const isPlaywright = typeof process !== 'undefined' && process?.env?.PLAYWRIGHT_TEST !== undefined

//

type Awaitable<T> = Promise<T> | T

type SubTestRunnerFunc = (name: string, f: () => Awaitable<void>) => Awaitable<void>

type Test = readonly[string, unknown]

type TestFunc = (f: SubTestRunnerFunc) => Awaitable<void>

type CommonFramework = (name: string, f: TestFunc) => Awaitable<void>

const createFramework = (fw: typeof nodeTest): CommonFramework =>
    (prefix, testFunc) => fw.test(prefix, t => testFunc((name, v) => t.test(name, v)))

// Bun doesn't support nested tests yet.
// See https://github.com/oven-sh/bun/issues/5090
const createBunFramework = (fw: typeof nodeTest): CommonFramework =>
    (prefix, testFunc) => testFunc((name, v) => fw.test(`${prefix}: ${name}`, v))

const createPlaywrightFramework = async (): Promise<CommonFramework> => {
    const pwTest = (await import('@playwright/test')).test
    return (prefix, testFunc) => testFunc((name, v) => pwTest(`${prefix}: ${name}`, v))
}

const framework: CommonFramework =
    isPlaywright ? await createPlaywrightFramework() :
    isBun ? createBunFramework(nodeTest) :
        createFramework(nodeTest)

const parse = parseTestSet(io.tryCatch)

const scanModule = (x: Test): TestFunc => async(subTestRunner: SubTestRunnerFunc) => {
    let subTests = [x]
    while (true) {
        const [first, ...rest] = subTests
        if (first === undefined) {
            break
        }
        subTests = rest
        //
        const [name, value] = first
        const set = parse(value)
        if (typeof set === 'function') {
            await subTestRunner(name, () => {
                const r = set()
                subTests = [...subTests, [`${name}()`, r]]
            })
        } else {
            for (const [j, y] of set) {
                const pr = `${name}/${j}`
                subTests = [...subTests, [pr, y]]
            }
        }
    }
}

const run = async(): Promise<void> => {
    const x = await loadModuleMap(io)
    for (const [i, v] of Object.entries(x)) {
        if (isTest(i)) {
            framework(i, scanModule(['', v.default]))
        }
    }
}

// we need `await` for Playwright.
await run()
