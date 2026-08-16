/**
 * CAS CLI command handlers.
 *
 * @module
 *
 * @import { All, Read, Write, WriteFile } from '../../effects/node/types.ts'
 * @import { Commands } from '../../cli/types.ts'
 * @import { MemOp } from '../../effects/memory/types.ts'
 * @import { FileCasOperation } from '../types.ts'
 */

import { sha256 } from '../../crypto/sha2/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { forEachStep, pure, step } from '../../effects/module.f.mjs'
import { errorExit, exitStep, log, writeFromStream } from '../../effects/node/module.f.mjs'
import { step as ioStep, unwrapStep } from '../../effects/io/module.f.mjs'
import { dispatch } from '../../cli/module.f.mjs'
import { casAddFile, fileCas } from '../module.f.mjs'

/** @type {Commands<FileCasOperation | WriteFile | Write | All | MemOp | Read>} */
export const commands = [
    {
        names: ['add'],
        description: 'Store file content and print its hash',
        handler: ({ home, args: [path, ...rest] }) => {
            if (path === undefined || rest.length !== 0) {
                return errorExit("'cas add' expects one parameter")
            }
            const c = fileCas(sha256)(home)
            const added = casAddFile(c)(path)
            const logged = ioStep(added, hash => log(vecToCBase32(hash)))
            return exitStep(logged)
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
            return exitStep(writeFromStream(path, x))
        },
    },
    {
        names: ['list'],
        description: 'List all stored content hashes',
        handler: ({ home }) => {
            const c = fileCas(sha256)(home)
            // A listing that cannot reach stdout has no useful fallback, and
            // `forEachStep`'s `void` accumulator would otherwise discard each
            // write's outcome silently.
            const x0 = forEachStep(c.list(), j => unwrapStep(log(vecToCBase32(j))))
            return step(
                x0,
                () => pure(0)
            )
        },
    },
]

export const main = dispatch(commands)
