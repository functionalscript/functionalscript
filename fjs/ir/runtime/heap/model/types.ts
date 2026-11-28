/**
 * What the model of the IR heap's bump arena ([module.f.js](./module.f.js))
 * keeps, which its proof and the arena's host proof read too.
 *
 * @module
 */

/**
 * What the arena keeps: the memory's size in pages and the most that the
 * host lets it grow to, where its state words are, the pointer, and the end
 * of the region that the pointer is in.
 */
export type Arena = {
    readonly pages: number
    readonly most: number
    readonly state: number
    readonly top: number
    readonly end: number
}
