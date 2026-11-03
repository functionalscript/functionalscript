/**
 * Types for the personal-notes check.
 *
 * @module
 */

/**
 * A changed file as the GitHub REST API lists it: `previous_filename` is the
 * old path of a renamed file.
 */
export type ChangedFile = {
    readonly filename: string
    readonly previous_filename?: string
}
