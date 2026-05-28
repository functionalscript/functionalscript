import { io } from '../../io/module.ts'
import { loadModuleMap } from '../module.f.ts'
import { type RegisterTest, registerModuleMap } from './module.f.ts'
import * as nodeTest from 'node:test'
import { fromIo } from '../../io/module.f.ts'
import { type ToAsyncOperationMap } from '../../types/effects/module.f.ts'
import { asyncRun } from '../../types/effects/module.ts'
import { type All } from '../../types/effects/node/module.f.ts'

//

type TestContext = {
    test: TestFn
}

type TestFn = (
    name: string,
    options: { readonly expectFailure: boolean },
    fn: (t: TestContext) => void | Promise<void>
) => void

const makeMap = (testFn: TestContext): ToAsyncOperationMap<RegisterTest | All> => {
    const m: ToAsyncOperationMap<RegisterTest | All> = {
        all: async (...effects) => Promise.all(effects.map(asyncRun(m))),
        registerTest: async (name, expectFailure, test) =>
            testFn.test(name, { expectFailure }, async t => asyncRun(makeMap(t))(test())),
    }
    return m
}

const map: ToAsyncOperationMap<RegisterTest | All> = makeMap(nodeTest)

export const run = async (): Promise<void> => {
    const moduleMap = await fromIo(io)(loadModuleMap(io.process.env))
    await asyncRun(map)(registerModuleMap(moduleMap))
}
