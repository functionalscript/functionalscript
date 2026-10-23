/**
 * CAS CLI command handlers.
 *
 * @module
 *
 * @import { All, Read, Write, WriteFile } from '../../effects/node/types.ts'
 * @import { DocumentedCommands } from '../../cli/types.ts'
 * @import { MemOp } from '../../effects/memory/types.ts'
 * @import { FileCasOperation } from '../types.ts'
 * @import { WriteOperation } from '../git/types.ts'
 */

import { sha256 } from '../../crypto/sha2/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.mjs'

import { errorExit, exitStep, log, writeFromStream } from '../../effects/node/module.f.mjs'
import { forEachStep, step as ioStep } from '../../effects/module.f.mjs'
import { casAddFile, fileCas } from '../module.f.mjs'
import { exactArgs } from '../../cli/module.f.mjs'
import { commands as gitCommands } from '../git/cli/module.f.mjs'

/** @type {DocumentedCommands<FileCasOperation | WriteOperation | WriteFile | Write | All | MemOp | Read>} */
export const commands = [
    {
        names: ['add'],
        description: 'Store file content and print its hash',
        usage: 'fjs cas add <path>',
        examples: ['fjs cas add ./README.md'],
        note: 'Store an existing file and print its hash; this example uses a repository checkout.',
        docs: 'fjs/cas/cli/module.f.mjs',
        handler: exactArgs('cas add', 1)(({ home, args: [path] }) => {
            const c = fileCas(sha256)(home)
            const added = casAddFile(c)(path)
            const logged = ioStep(added, hash => log(vecToCBase32(hash)))
            return exitStep(logged)
        }),
    },
    {
        names: ['get'],
        description: 'Restore content by hash into a file',
        usage: 'fjs cas get <hash> <path>',
        examples: ['hash=$(fjs cas add ./README.md)\nfjs cas get "$hash" ./restored-README.md'],
        note: 'Restore a stored hash to a file. This POSIX shell example requires a repository checkout and writes restored-README.md.',
        docs: 'fjs/cas/cli/module.f.mjs',
        handler: exactArgs('cas get', 2)(({ home, args: [hashCBase32, path] }) => {
            const hash = cBase32ToVec(hashCBase32)
            if (hash === null) {
                return errorExit(`invalid hash format: ${hashCBase32}`)
            }
            const c = fileCas(sha256)(home)
            const x = c.read(hash)
            return exitStep(writeFromStream(path, x))
        }),
    },
    {
        names: ['list'],
        description: 'List all stored content hashes',
        usage: 'fjs cas list',
        examples: ['fjs cas list'],
        note: 'Print all hashes in the local store.',
        docs: 'fjs/cas/cli/module.f.mjs',
        handler: ({ home }) => {
            const c = fileCas(sha256)(home)
            // The fold's `items` is deliberately a raw effect, so a fallible
            // producer composes with `step` ahead of it rather than the fold
            // growing an error channel of its own.
            // `c.list()` feeds the fold directly: the step that used to sit
            // here existed only to unwrap the list so `pure` could wrap it
            // again.
            return exitStep(forEachStep(c.list(), j => log(vecToCBase32(j))))
        },
    },
    {
        names: ['git'],
        description: 'Use a Git branch as the store: add, get and list',
        usage: 'fjs cas git <command> <branch> [args]',
        examples: ['fjs cas git help'],
        note: 'The same three commands over a branch of the repository the current directory is in. Nothing moves between repositories: git push, git fetch and git merge do.',
        docs: 'fjs/cas/git/README.md',
        handler: gitCommands,
    },
]

export const main = commands
