/**
 * Whether a pull request is only its author's personal notes: every changed
 * file, and every renamed file's old path, under `doc/<author's login>/`, and
 * an author who may write to the repository. The personal-notes workflow
 * approves such a pull request and leaves every other one to people.
 *
 * @module
 */

/**
 * A changed file as the GitHub REST API lists it: `previous_filename` is the
 * old path of a renamed file.
 *
 * @typedef {{ readonly filename: string, readonly previous_filename?: string }} ChangedFile
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

/** @type {(author: string, permission: string, files: readonly ChangedFile[]) => boolean} */
export const onlyPersonalNotes = (author, permission, files) => {
    const prefix = notesPrefix(author)
    /** @type {(path: string | undefined) => boolean} */
    const inside = path => path === undefined || path.startsWith(prefix)
    return canWrite(permission)
        && files.length !== 0
        && files.every(file => inside(file.filename) && inside(file.previous_filename))
}
