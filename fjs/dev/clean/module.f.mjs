/**
 * `npm run gen:clean`: deletes every generated file — a file whose name starts
 * with `gen.`, and every file inside a directory whose name does — so the drift
 * check regenerates from nothing and a stale output shows up as a deletion
 * ([generated-file-conventions](../../../todo/generated-file-conventions.md)).
 *
 * Directories stay, emptied: `rm` removes files only, and git tracks no empty
 * directory, so the drift check cannot see one. Dot-names (`.git` among them),
 * `node_modules` and `target` are not entered: they hold third-party files,
 * whose names follow no convention of this repository.
 *
 * @module
 *
 * @import { All, Dirent, IoChannel, NodeProgram, Readdir, Rm } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 */

import { step } from '../../effects/module.f.mjs'
import { allOk, exitStep, rm } from '../../effects/node/module.f.mjs'
import { walk } from '../module.f.mjs'

/** Whether a file or directory name marks it generated. @type {(name: string) => boolean} */
export const isGenerated = name => name.startsWith('gen.')

/**
 * Inside a generated directory everything is taken; outside one, a generated
 * file is taken and third-party trees are skipped.
 *
 * @type {(path: string, entry: Dirent) => 'take' | 'descend' | 'skip'}
 */
const classify = (path, { name, isDirectory }) =>
    path.split('/').some(isGenerated) ? (isDirectory ? 'descend' : 'take')
    : name.startsWith('.') || name === 'node_modules' || name === 'target' ? 'skip'
    : isDirectory ? 'descend'
    : 'skip'

/** The generated files under `root`. @type {(root: string) => Effect<Readdir | All, readonly string[], IoChannel>} */
export const generatedFiles = root => walk(root, classify)

/** Deletes the generated files under `root`. @type {(root: string) => Effect<Readdir | All | Rm, readonly void[], IoChannel>} */
export const clean = root => step(generatedFiles(root), files => allOk(...files.map(rm)))

/** @type {NodeProgram} */
export const main = () => exitStep(clean('.'))
