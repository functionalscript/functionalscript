import { io } from '../../io/module.ts'
import { loadModuleMap } from '../module.f.ts'
import { isTest, parseTestSet } from './module.f.ts'
import * as nodeTest from 'node:test'
import { asyncImport } from '../../io/module.ts'

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
        const [name, value, throws] = first
        const set = parse(throws)(value)
        if (typeof set === 'function') {
            await subTestRunner(name, () => {
                const r = set()
                // The result of a function is walked as a fresh sub-tree;
                // the parent's `throws` flag does not propagate into it.
                subTests = [...subTests, [`${name}()`, r, false]]
            })
        } else {
            for (const [j, y] of set) {
                const pr = `${name}/${j}`
                subTests = [...subTests, [pr, y, throws || j === 'throw']]
            }
        }
    }
}

export const run = async(): Promise<void> => {
    const x = await loadModuleMap(io)
    for (const [i, v] of Object.entries(x)) {
        if (isTest(i)) {
            framework(i, scanModule(['', v.default, false]))
        }
    }
}


