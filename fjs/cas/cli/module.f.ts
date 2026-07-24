/**
 * CAS CLI command handlers.
 *
 * @module
 */
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { eff, forEachStep, pure } from '../../effects/module.f.ts'
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
            return eff(casAddFile(c)(path)).step(hashResult => hashResult[0] === 'error'
                    ? pure(1)
                    : eff(log(vecToCBase32(hashResult[1]))).step(() => pure(0)).value).value
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
            return eff(writeFromStream(path, x)).step(([r, v]) => r === 'error' ? errorExit(`e: ` + String(v)) : pure(0)).value
        },
    },
    {
        names: ['list'],
        description: 'List all stored content hashes',
        handler: ({ home }) => {
            const c = fileCas(sha256)(home)
            return eff(c.list())
                .step(forEachStep(j => log(vecToCBase32(j))))
                .step(() => pure(0))
                .value
        },
    },
]

export const main = dispatch(commands)
