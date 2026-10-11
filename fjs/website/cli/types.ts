/**
 * Command metadata and the curated documentation layer of the CLI reference.
 * @module
 */

export type Entry = {
    readonly path: readonly string[]
    readonly aliases: readonly string[]
    readonly description: string
}

/** Usage stays curated until the CLI declares structured parameters. */
export type Guide = {
    readonly name: string
    readonly usage: string
    readonly examples: readonly string[]
    readonly note: string
    readonly docs: string
}
