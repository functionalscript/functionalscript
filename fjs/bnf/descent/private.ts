import type { Cursor } from "../matcher/types.ts"
import type { TerminalRange } from "../types.ts"

/**
 * The furthest-failure record while matching, positioned by the complete
 * {@link Cursor}. {@link DescentFailure} is its public, physically-positioned
 * form.
 */
export type _Failure = {
    readonly pos: Cursor
    readonly expected: readonly TerminalRange[]
}
