/**
 * CAS CLI command handlers.
 *
 * @module
 */
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { msb, type Vec } from '../../types/bit_vec/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../../cbase32/module.f.ts'
import { forEachStep, listEffectCons, listEffectEnd, pure, type Effect, type ListEffect } from '../../effects/module.f.ts'
import { reverse, type List } from '../../types/list/module.f.ts'
import {
    errorExit,
    log,
    readFile,
    writeFile,
    type All,
    type IoResult,
    type Read,
    type ReadFile,
    type Write,
    type WriteFile
} from '../../effects/node/module.f.ts'
import { dispatch, type Commands } from '../../cli/module.f.ts'
import { type MemOp } from '../../effects/memory/module.f.ts'
import { fileCas, type FileCasOperation } from '../module.f.ts'

export const commands: Commands<FileCasOperation | ReadFile | WriteFile | Write | All | MemOp | Read> = [
    {
        names: ['add'],
        description: 'Store file content and print its hash',
        handler: ({ home, args: [path, ...rest] }) => {
            if (path === undefined || rest.length !== 0) {
                return errorExit("'cas add' expects one parameter")
            }
            const c = fileCas(sha256)(home)
            // The source is read in one `<=128 KiB` chunk; feed it as a single-item stream.
            return readFile(path)
                .step(v => c.write(listEffectCons(v, listEffectEnd())))
                .step(hashResult => hashResult[0] === 'error'
                    ? pure(1)
                    : log(vecToCBase32(hashResult[1])).step(() => pure(0)))
        },
    },
    {
        names: ['get'],
        description: 'Restore content by hash into a file',
        handler: ({ home, args: [hashCBase32, path, ...rest] }) => {
            if (hashCBase32 === undefined || path === undefined || rest.length !== 0) {
                return errorExit("'cas get' expects two parameters")
            }
            const hash = cBase32ToVec(hashCBase32)
            if (hash === null) {
                return errorExit(`invalid hash format: ${hashCBase32}`)
            }
            const c = fileCas(sha256)(home)
            // Drain the read stream, gathering chunks; an error item means the shard is absent.
            const collect = (acc: List<Vec>) =>
                (stream: ListEffect<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation | WriteFile | Write, number> =>
                    stream.step((node): Effect<FileCasOperation | WriteFile | Write, number> => {
                        if (node === undefined) {
                            return writeFile(path, msb.listToVec(reverse(acc))).step(() => pure(0))
                        }
                        const [item, rest2] = node
                        if (item[0] === 'error') { return errorExit(`no such hash: ${hashCBase32}`) }
                        return collect({ first: item[1], tail: acc })(rest2)
                    })
            return collect(null)(c.read(hash))
        },
    },
    {
        names: ['list'],
        description: 'List all stored content hashes',
        handler: ({ home }) => {
            const c = fileCas(sha256)(home)
            return c.list()
                .step(forEachStep(j => log(vecToCBase32(j))))
                .step(() => pure(0))
        },
    },
]

export const main = dispatch(commands)
