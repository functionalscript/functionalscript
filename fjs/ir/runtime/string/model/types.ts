/**
 * What the model of String's IR module where the IR heap holds long
 * strings ([module.f.js](./module.f.js)) keeps of a string, which its proof
 * and the module's host proof read too.
 *
 * @module
 */

/**
 * Which form a string has: `short`, a box that holds it; `ir`, a block in
 * the IR heap; `host`, a string of the host's, NaNVM's own.
 */
export type Form = 'short' | 'ir' | 'host'

/** A string: its form and its UTF-16 units. */
export type Str = {
    readonly form: Form
    readonly units: readonly number[]
}
