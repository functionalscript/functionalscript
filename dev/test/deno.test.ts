import { io } from '../../io/module.ts'
import { loadModuleMap } from '../module.f.ts'

type DenoTestStep = {
    readonly step: (name: string, f: () => void | Promise<void>) => Promise<void>
}

type DenoFunc = (t: DenoTestStep) => void | Promise<void>

type DenoArg = readonly[string, DenoFunc]

declare namespace Deno {
    function test(...arg: DenoArg): void
}

//using db = await openDatabase();
//  await t.step("insert user", async () => {
//    // Insert user logic
//  });
//  await t.step("insert book", async () => {
//    // Insert book logic
//  });

const x = await loadModuleMap(io)

const f = (p: string) => (x: unknown) => {
    switch (typeof x) {
        case "function": {
            if (x.length === 0) {
                const g = x.name === 'throw'
                    ? async() => {
                        try {
                            x()
                            throw new Error(`Expected ${p} to throw, but it did not.`)
                        } catch {}
                    }
                    : async() => {
                        const r = x()
                        if (r !== undefined) {
                            
                        }
                    }
                Deno.test(p, g)
            }
            break
        }
        case "object": {
            if (x !== null) {
                for (const [j, y] of Object.entries(x)) {
                    f(`${p}/${j}`)(y)
                }
            }
            break
        }
    }
}

for (const [i, v] of Object.entries(x)) {
    f(i)(v.default)
}
