import { promises } from 'node:fs'
import { argv } from 'node:process'
import type { IoResult, MkdirParam, NodeOperationMap, NodeProgram, ReaddirParam, WriteFileParam } from './module.f.ts'
import type { Vec } from '../../bit_vec/module.f.ts'
import { fromVec, toVec } from '../../uint8array/module.f.ts'
import { asyncRun } from '../module.ts'

const { mkdir, readFile, readdir, writeFile } = promises

const { log } = console

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
        log(message),
    mkdir: (param: MkdirParam): Promise<IoResult<void>> =>
        tc(async() => { await mkdir(...param) }),
    readFile: (path: string): Promise<IoResult<Vec>> =>
        tc(async() => toVec(await readFile(path))),
    readdir: (param: ReaddirParam): Promise<IoResult<readonly string[]>> =>
        tc(() => readdir(...param)),
    writeFile: ([path, data]: WriteFileParam): Promise<IoResult<void>> =>
        tc(() => writeFile(path, fromVec(data))),
}

const nr = asyncRun(nodeOperationMap)

export const nodeRun = (p: NodeProgram): Promise<number> => nr(p(argv))
