import { promises } from 'fs'
import { type NodeOperationMap } from './module.f.ts'

const { readFile } = promises

const nodeOperationMap: NodeOperationMap = {
    'console.log': async (message: string): Promise<void> => console.log(message),
    'fs.promises.readFile': readFile,
}
