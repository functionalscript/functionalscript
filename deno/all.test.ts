import { io } from '../io/module.ts'
import { loadModuleMap } from '../dev/module.f.ts'
import { isTest, parseTestSet } from '../dev/tf/module.f.ts'

type SubTestRunnerFunc = (name: string, f: () => void | Promise<void>) => Promise<void>

type SubTestRunner<N extends string> = {
    readonly [name in N]: SubTestRunnerFunc
}

type FrameworkTestFunc<N extends string> = (f: SubTestRunner<N>) => Promise<void>

type FrameworkArg<N extends string> = readonly [name: string, f: FrameworkTestFunc<N>]

type FrameworkTest<N extends string> = (...arg: FrameworkArg<N>) => void | Promise<void>

type Framework<N extends string> = {
    readonly test: FrameworkTest<N>
}

declare const Deno: Framework<'step'> | undefined

const isDeno = typeof Deno !== 'undefined'

declare const Bun: object | undefined

const isBun = typeof Bun !== 'undefined'

type Test = readonly[string, unknown]

type BunTest = {
    readonly describe: (name: string, f: () => Promise<void>|void) => Promise<void>
    readonly test: (name: string, f: () => Promise<void>|void) => Promise<void>
}

const createBunFramework = (b: BunTest): CommonFramework =>
    (name, f) => b.describe(name, () => f((name, v) => b.test(name, v)))

//

type TestFunc = (f: SubTestRunnerFunc) => Promise<void>

type CommonFramework = (name: string, f: TestFunc) => void | Promise<void>

const createFramework = <N extends string>(step: N, fw: Framework<N>): CommonFramework =>
    (name, f) => fw.test(name, t => f((name, v) => t[step](name, v)))

const framework = async(): Promise<CommonFramework> => {
    if (isDeno) {
        // Deno
        return createFramework('step', Deno)
    }
    if (isBun) {
        // Bun
        // deno-lint-ignore no-explicit-any
        const x: BunTest = await import('bun:test' as any)
        return createBunFramework(x)
    }
    // Node.js
    return createFramework('test', await import('node:test'))
}

const parse = parseTestSet(io.tryCatch)

const test = (x: Test): TestFunc => async(subTestRunner: SubTestRunnerFunc) => {
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
    const fw = await framework()
    const x = await loadModuleMap(io)
    for (const [i, v] of Object.entries(x)) {
        if (isTest(i)) {
            fw(i, test(['', v.default]))
        }
    }
}

await run()
