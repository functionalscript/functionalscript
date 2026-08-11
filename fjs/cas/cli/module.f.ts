/**
 * CAS CLI command handlers.
 *
 * @module
 */
import { sha256 } from '../../crypto/sha2/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { forEachStep, pure, step } from '../../effects/module.f.mjs'
import { errorExit, log, writeFromStream } from '../../effects/node/module.f.mjs'
import type { All, Read, Write, WriteFile } from '../../effects/node/types.ts'
import { dispatch } from '../../cli/module.f.mjs'
import type { Commands } from '../../cli/types.ts'
import type { MemOp } from '../../effects/memory/types.ts'
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
            return step(
                casAddFile(c)(path),
                hashResult => hashResult[0] === 'error'
                    ? pure(1)
                    : step(
                        log(vecToCBase32(hashResult[1])),
                        () => pure(0)
                    )
            )
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
            return step(
                writeFromStream(path, x),
                ([r, v]) => r === 'error' ? errorExit(`e: ` + String(v)) : pure(0),
            )
        },
    },
    {
        names: ['list'],
        description: 'List all stored content hashes',
        handler: ({ home }) => {
            const c = fileCas(sha256)(home)
            const x0 = forEachStep(c.list(), j => log(vecToCBase32(j)))
            return step(
                x0,
                () => pure(0)
            )
        },
    },
]

export const main = dispatch(commands)
