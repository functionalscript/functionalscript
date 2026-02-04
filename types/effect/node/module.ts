import { promises } from 'node:fs'
import { argv } from 'node:process'
import type { IoResult, NodeOperationMap, NodeProgram } from './module.f.ts'
import type { Vec } from '../../bit_vec/module.f.ts'
import { fromVec, toVec } from '../../uint8array/module.f.ts'
import { asyncRun } from '../module.ts'

const { readFile, writeFile } = promises

const tc = async<T>(f: () => Promise<T>): Promise<IoResult<T>> => {
    try {
        const r = await f()
        return ['ok', r]
    } catch (e) {
        return ['error', e]
    }
}

const nodeOperationMap: NodeOperationMap = {
    log: async (message: string): Promise<void> =>
        console.log(message),
    readFile: (path: string): Promise<IoResult<Vec>> =>
        tc(async() => toVec(await readFile(path))),
    writeFile: ([path, data]: readonly[string, Vec]): Promise<IoResult<void>> =>
        tc(() => writeFile(path, fromVec(data)))
}

const nr = asyncRun(nodeOperationMap)

export const nodeRun = (p: NodeProgram): Promise<number> => nr(p(argv))
