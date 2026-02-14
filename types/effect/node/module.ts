import type { IoResult, NodeOperationMap, NodeProgram } from './module.f.ts'
import { fromVec, toVec } from '../../uint8array/module.f.ts'
import { asyncRun } from '../module.ts'
import type { Io } from '../../../io/module.f.ts'
import { io } from '../../../io/module.ts'
import { error, ok } from '../../result/module.f.ts'

const tc = async<T>(f: () => Promise<T>): Promise<IoResult<T>> => {
    try {
        return ok(await f())
    } catch (e) {
        return error(e)
    }
}

export const fromIo = ({
    console: { error, log },
    fs: { promises: { mkdir, readFile, readdir, writeFile } },
}: Io): NodeOperationMap => ({
    error: async message => error(message),
    log: async message => log(message),
    mkdir: param => tc(async() => { await mkdir(...param) }),
    readFile: path => tc(async() => toVec(await readFile(path))),
    readdir: param => tc(() => readdir(...param)),
    writeFile: ([path, data]) => tc(() => writeFile(path, fromVec(data))),
})

export const ioRun = (io: Io): (p: NodeProgram) => Promise<number> => {
    const nr = asyncRun(fromIo(io))
    return p => nr(p(io.process.argv))
}

export const nodeRun = ioRun(io)
