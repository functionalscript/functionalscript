import { io } from '../../io/module.ts'
import { loadModuleMap } from '../module.f.ts'
import { registerModuleMap } from './module.f.ts'
import * as nodeTest from 'node:test'
import { fromIo } from '../../io/module.f.ts'
import { type ToAsyncOperationMap } from '../../types/effects/module.f.ts'
import { asyncRun } from '../../types/effects/module.ts'
import { type All, type Test } from '../../types/effects/node/module.f.ts'

const map: ToAsyncOperationMap<Test | All> = {
    all: async (...effects) => Promise.all(effects.map(aMap)),
    test: async (ctx, name, expectFailure, test) =>
        ctx.test(name, { expectFailure }, async t => aMap(test(t))),
}

const aMap = asyncRun(map)

export const run = async (): Promise<void> => {
    const moduleMap = await fromIo(io)(loadModuleMap(io.process.env))
    await aMap(registerModuleMap(nodeTest, moduleMap))
}
