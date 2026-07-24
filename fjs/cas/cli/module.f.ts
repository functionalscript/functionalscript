/**
 * CAS CLI command handlers.
 *
 * @module
 */
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { step, forEachStep, pure } from '../../effects/module.f.ts'
import {
    errorExit,
    log,
    writeFromStream,
    type All,
    type Read,
    type Write,
    type WriteFile
} from '../../effects/node/module.f.ts'
import { dispatch, type Commands } from '../../cli/module.f.ts'
import { type MemOp } from '../../effects/memory/module.f.ts'
import { casAddFile, fileCas, type FileCasOperation } from '../module.f.ts'

export const commands: Commands<FileCasOperation | WriteFile | Write | All | MemOp | Read> = [
    {
        names: ['add'],
        description: 'Store file content and print its hash',
        handler: ({ home, args: [path, ...rest] }) => {
            if (path === undefined || rest.length !== 0) {
                return errorExit("'cas add' expects one parameter")
            }
            const c = fileCas(sha256)(home)
            return step(casAddFile(c)(path),
                hashResult => hashResult[0] === 'error'
                    ? pure(1)
                    : step(log(vecToCBase32(hashResult[1])), () => pure(0)))
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
            const x = c.read(hash)
            return step(writeFromStream(path, x),
                ([r, v]) => r === 'error' ? errorExit(`e: ` + String(v)) : pure(0))
        },
    },
    {
        names: ['list'],
        description: 'List all stored content hashes',
        handler: ({ home }) => {
            const c = fileCas(sha256)(home)
            return step(step(c.list(),
                forEachStep(j => log(vecToCBase32(j)))),
                () => pure(0))
        },
    },
]

export const main = dispatch(commands)
