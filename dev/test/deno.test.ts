import { io } from '../../io/module.ts'
import { loadModuleMap } from '../module.f.ts'
import { isTest } from './module.f.ts'

type DenoTestStep = {
    readonly step: (name: string, f: () => void | Promise<void>) => Promise<void>
}

type DenoFunc = (t: DenoTestStep) => void | Promise<void>

type DenoArg = readonly[string, DenoFunc]

declare namespace Deno {
    function test(...arg: DenoArg): void
}

const x = await loadModuleMap(io)

type Test = readonly[string, unknown]

const f = (x: Test) => async(t: DenoTestStep) => {
    let subTests = [x]
    while (true) {
        const [first, ...rest] = subTests
        if (first === undefined) {
            break
        }
        subTests = rest
        //
        const [name, value] = first
        if (value === null) {
            continue
        }
        switch (typeof value) {
            case "function": {
                if (value.length === 0) {
                    const g = value.name === 'throw'
                        ? () => {
                            try {
                                value()
                                throw new Error(`Expected ${name} to throw, but it did not.`)
                            } catch {}
                        }
                        : () => {
                            const r = value()
                            subTests = [...subTests, [`${name}()`, r]]
                        }
                    await t.step(name, g)
                }
                break
            }
            case "object": {
                for (const [j, y] of Object.entries(value)) {
                    const pr = `${name}/${j}`
                    subTests = [...subTests, [pr, y]]
                }
                break
            }
        }
    }
}

for (const [i, v] of Object.entries(x)) {
    if (isTest(i)) {
        Deno.test(i, f(['', v.default]))
    }
}
