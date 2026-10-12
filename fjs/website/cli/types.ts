/** Command metadata consumed by the CLI reference. @module */

import type { CommandReference } from '../../cli/types.ts'

export type Entry = CommandReference & {
    readonly path: readonly string[]
    readonly aliases: readonly string[]
    readonly description: string
}
