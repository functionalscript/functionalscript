import { io } from '../io/module.ts'
import { loadModuleMap } from '../dev/module.f.ts'
import { isTest, parseTestSet, shouldThrow } from '../dev/test/module.f.ts'

type DenoTestStep = {
    readonly step: (name: string, f: () => void | Promise<void>) => Promise<void>
}

type DenoFunc = (t: DenoTestStep) => void | Promise<void>

type DenoArg = readonly[string, DenoFunc]

export type DenoTest = (...arg: DenoArg) => void

type Test = readonly[string, unknown]

declare namespace Deno {
    const test: DenoTest
}

const parse = parseTestSet(io.tryCatch)

const denoTest = (x: Test) => async(t: DenoTestStep) => {
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
            const g = () => {
                const r = set()
                subTests = [...subTests, [`${name}()`, r]]
            }
            await t.step(name, g)
        } else {
            for (const [j, y] of set) {
                const pr = `${name}/${j}`
                subTests = [...subTests, [pr, y]]
            }
        }
    }
}

export default async(): Promise<void> => {
    const x = await loadModuleMap(io)

    for (const [i, v] of Object.entries(x)) {
        if (isTest(i)) {
            Deno.test(i, denoTest(['', v.default]))
        }
    }
}
