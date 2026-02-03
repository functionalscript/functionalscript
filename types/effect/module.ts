import { promises } from 'fs'
import { type NodeEffect, type NodeOperationMap } from './module.f.ts'

const { readFile } = promises

const nodeOperationMap: NodeOperationMap = {
    'console.log': async (message: string): Promise<void> => console.log(message),
    'fs.promises.readFile': readFile,
}

export const run = async<T>(effect: NodeEffect<T>): Promise<T> => {
    while (true) {
        if (effect[0] === 'pure') {
            return effect[1]
        }
        const [, command, payload, continuation] = effect
        const operation = nodeOperationMap[command]
        const result = await operation(payload)
        effect = continuation(result as any)
    }
}
