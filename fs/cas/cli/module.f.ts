/**
 * CAS CLI command handlers.
 *
 * @module
 */
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { forEachStep, pure } from '../../effects/module.f.ts'
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
import { casAddFile, fileCas, verifyHash, type FileCasOperation } from '../module.f.ts'

export const commands: Commands<FileCasOperation | WriteFile | Write | All | MemOp | Read> = [
    {
        names: ['add'],
        description: 'Store file content and print its hash',
        handler: ({ home, args: [path, ...rest] }) => {
            if (path === undefined || rest.length !== 0) {
                return errorExit("'cas add' expects one parameter")
            }
            const c = fileCas(sha256)(home)
            return casAddFile(c)(path)
                .step(hashResult => hashResult[0] === 'error'
                    ? pure(1)
                    : log(vecToCBase32(hashResult[1])).step(() => pure(0)))
        },
    },
    {
        names: ['get'],
        description: 'Restore content by hash into a file. Pass --verify to rehash the stored bytes and confirm they match the requested address before writing the file.',
        handler: ({ home, args }) => {
            const verify = args.includes('--verify')
            const [hashCBase32, path, ...rest] = args.filter(a => a !== '--verify')
            if (hashCBase32 === undefined || path === undefined || rest.length !== 0) {
                return errorExit("'cas get' expects two parameters")
            }
            const hash = cBase32ToVec(hashCBase32)
            if (hash === null) {
                return errorExit(`invalid hash format: ${hashCBase32}`)
            }
            const c = fileCas(sha256)(home)
            const restore = () => writeFromStream(path, c.read(hash))
                .step(([r, v]) => r === 'error' ? errorExit(`e: ` + String(v)) : pure(0))
            if (!verify) { return restore() }
            return verifyHash(c)(sha256)(hash).step(([r, v]) => {
                if (r === 'error') { return errorExit(`e: ` + String(v)) }
                return v ? restore() : errorExit(`hash mismatch: stored content does not hash to ${hashCBase32}`)
            })
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
