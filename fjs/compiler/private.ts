import type { Marked } from '../text/marked/types.ts'
import type { Result } from '../types/result/types.ts'

/** The compiler demo's source and independently computed output panes. */
export type _DemoState = {
    readonly text: string
    readonly panes: readonly Result<Marked, string>[]
}
