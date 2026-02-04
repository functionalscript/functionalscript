import { promises } from 'fs'
import type { NodeEffect, NodeOperationMap } from './module.f.ts'
import { run } from '../module.f.ts'
import type { Vec } from '../../bit_vec/module.f.ts'
import { fromVec, toVec } from '../../uint8array/module.f.ts'

const { readFile, writeFile } = promises

const nodeOperationMap: NodeOperationMap = {
    log: async (message: string): Promise<void> => console.log(message),
    readFile: async(path: string): Promise<Vec> => toVec(await readFile(path)),
    writeFile: ([path, data]: readonly[string, Vec]): Promise<void> => writeFile(path, fromVec(data))
}

export type NodeRun = <T>(effect: NodeEffect<T>) => Promise<T>

export const nodeRun: NodeRun = run(nodeOperationMap) as NodeRun
