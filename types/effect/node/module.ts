import { promises } from 'fs'
import type { NodeEffect, NodeOperationMap } from './module.f.ts'
import { run } from '../module.f.ts'

const { readFile } = promises

const nodeOperationMap: NodeOperationMap = {
    log: async (message: string): Promise<void> => console.log(message),
    readFile: readFile,
}

export type NodeRun = <T>(effect: NodeEffect<T>) => Promise<T>

export const nodeRun: NodeRun = run(nodeOperationMap) as NodeRun
