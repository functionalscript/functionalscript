/**
 * Input-only demo sharing. Outputs and action history never enter a link.
 * @module
 */

import type { StringMap } from '../../../types/object/types.ts'

export type InputValue = string | number | boolean
export type InputName<S> = { readonly [K in keyof S]: S[K] extends InputValue ? K : never }[keyof S] & string
export type Inputs = StringMap<InputValue>
export type InputField = {
    readonly default: InputValue
    /** Choices are validated before a state is constructed. Text accepts any string. */
    readonly choices?: readonly string[]
}
export type Fields = StringMap<InputField>
export type SharedExample = { readonly id: string, readonly inputs: Inputs }
export type Sharing<State> = {
    readonly fields: Fields
    readonly examples: readonly SharedExample[]
    /** Optional validation of relationships between otherwise valid fields. */
    readonly validate?: (inputs: Inputs) => string | null
    readonly read: (state: State) => Inputs
    /** Receives a complete, validated input set; replace state in one operation. */
    readonly restore: (inputs: Inputs) => State
}
export type Query =
    | { readonly kind: 'defaults' }
    | { readonly kind: 'inputs', readonly values: StringMap<string> }

export type RestoreDisposition = 'apply' | 'edited' | 'navigated'

/** State access for the shared URL boundary; replacements are queued atomically. */
export type DemoController = {
    readonly step: (event: import('../types.ts').DemoEvent) => void
    readonly read: () => any
    readonly busy: () => boolean
    readonly revision: () => number
    readonly replace: (state: any, after: () => void, current: () => RestoreDisposition, initialize?: boolean) => void
}
