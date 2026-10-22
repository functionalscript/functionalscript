/**
 * The undecided constructs' page ([`./demo.f.mjs`](./demo.f.mjs)).
 *
 * @module
 */

import type { Entry } from '../../fjs/media/markdown/types.ts'
import type { Loaded } from '../../fjs/nanvm/demos/page/types.ts'

/**
 * An **open** row of the refused constructs register: its ID, its
 * construct cell, and what its **Why** cell says beside the word `open`,
 * the related record when there is one.
 */
export type OpenRow = {
    readonly id: string
    readonly construct: Entry
    readonly related: Entry
}

/** The register's text, once fetched. */
export type State = {
    readonly register: Loaded<string>
}
