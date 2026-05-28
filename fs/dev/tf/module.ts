import { io } from '../../io/module.ts'
import { loadModuleMap } from '../module.f.ts'
import { isTest, type RegisterTest, registerModule } from './module.f.ts'
import * as nodeTest from 'node:test'
import { asyncImport } from '../../io/module.ts'
import { fromIo } from '../../io/module.f.ts'
import { type ToAsyncOperationMap } from '../../types/effects/module.f.ts'
import { asyncRun } from '../../types/effects/module.ts'
import { type All } from '../../types/effects/node/module.f.ts'

//

const isPlaywright = typeof process !== 'undefined' && process?.env?.PLAYWRIGHT_TEST !== undefined

//

type TestFn = (name: string, options: { readonly expectFailure: boolean }, fn: () => void | Promise<void>) => void

const makeMap = (testFn: TestFn): ToAsyncOperationMap<RegisterTest | All> => {
    const m: ToAsyncOperationMap<RegisterTest | All> = {
        all: async (...effects) => Promise.all(effects.map(asyncRun(m))),
        registerTest: async (name, expectFailure, test) =>
            testFn(name, { expectFailure }, async () => asyncRun(m)(test())),
    }
    return m
}

const createPlaywrightMap = async (): Promise<ToAsyncOperationMap<RegisterTest | All>> => {
    const pwTest = (await asyncImport('@playwright/test') as any).test
    return makeMap((name, _opts, fn) => pwTest(name, fn))
}

const map: ToAsyncOperationMap<RegisterTest | All> = isPlaywright
    ? await createPlaywrightMap()
    : makeMap((name, opts, fn) => nodeTest.test(name, opts, fn))

export const run = async (): Promise<void> => {
    const moduleMap = await fromIo(io)(loadModuleMap(io.process.env))
    for (const [k, v] of Object.entries(moduleMap)) {
        if (isTest(k)) {
            await asyncRun(map)(registerModule(k, v))
        }
    }
}
