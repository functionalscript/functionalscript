import { io } from '../io/module.ts'
import { loadModuleMap } from '../dev/module.f.ts'
import { isTest, parseTestSet } from '../dev/tf/module.f.ts'
import * as nodeTest from 'node:test'

//

declare const Bun: object | undefined

const isBun = typeof Bun !== 'undefined'

//

type Awaitable<T> = Promise<T> | T

type SubTestRunnerFunc = (name: string, f: () => Awaitable<void>) => Awaitable<void>

type Test = readonly[string, unknown]

type TestFunc = (f: SubTestRunnerFunc) => Awaitable<void>

type CommonFramework = (name: string, f: TestFunc) => Awaitable<void>

const createFramework = (fw: typeof nodeTest): CommonFramework =>
    (prefix, f) => fw.test(prefix, t => f((name, v) => t.test(name, v)))

const createBunFramework = (fw: typeof nodeTest): CommonFramework =>
    (prefix, f) => f((name, v) => fw.test(`${prefix}: ${name}`, v))

const framework = isBun ? createBunFramework(nodeTest) : createFramework(nodeTest)

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

await run()
