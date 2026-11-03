/**
 * Whether a pull request is only its author's personal notes: every changed
 * file, and every renamed file's old path, under `doc/<author's login>/`, and
 * an author who may write to the repository. The list must hold every file
 * the pull request changes: the REST API lists at most 3,000, so a longer
 * pull request could hide a file past the cap. The personal-notes workflow
 * approves such a pull request and leaves every other one to people.
 *
 * @module
 *
 * @import { ChangedFile } from './types.ts'
 */

/** The directory that holds an author's personal notes. @type {(author: string) => string} */
export const notesPrefix = author => `doc/${author}/`

/**
 * The permissions the REST API answers that allow writing: `maintain` is
 * reported as `write`.
 *
 * @type {(permission: string) => boolean}
 */
export const canWrite = permission => permission === 'admin' || permission === 'write'

/**
 * `changedFiles` is the count the pull request itself reports.
 *
 * @type {(author: string, permission: string, files: readonly ChangedFile[], changedFiles: number) => boolean}
 */
export const onlyPersonalNotes = (author, permission, files, changedFiles) => {
    const prefix = notesPrefix(author)
    /** @type {(path: string | undefined) => boolean} */
    const inside = path => path === undefined || path.startsWith(prefix)
    return canWrite(permission)
        && files.length !== 0
        && files.length === changedFiles
        && files.every(file => inside(file.filename) && inside(file.previous_filename))
}
