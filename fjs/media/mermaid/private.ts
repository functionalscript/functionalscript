/**
 * Types internal to `fjs/media/mermaid/module.f.js`.
 *
 * @module
 */

/** A node as a statement names it: its name, and its label where one is written. */
export type _Named = readonly [id: string, label: string | null]
