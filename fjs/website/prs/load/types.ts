/**
 * Ordinary data used by the pull-request loading policy. Host requests, clocks,
 * locale formatting, scheduling, and DOM updates stay in the browser adapter.
 *
 * @module
 */

/** The next action after admitting one locally numbered response page. */
export type PageStep<T> =
    | { readonly tag: 'next', readonly page: number, readonly items: readonly T[] }
    | { readonly tag: 'done', readonly items: readonly T[] }
    | { readonly tag: 'error', readonly message: string }

/** HTTP response data and the host's parsed date and clock reading. */
export type RefusalInput = {
    readonly status: number
    readonly remaining: string | null
    readonly retryAfter: string | null
    readonly reset: string | null
    readonly now: number
    readonly retryDateMillis: number | null
}

/** Whether a refusal stops this load, and an optional future retry time. */
export type RefusalDecision = {
    readonly blocked: boolean
    readonly reason: string
    readonly retryAt: number | null
}

/** The count of unavailable CI summaries and their first readable reason. */
export type Failures = {
    readonly count: number
    readonly first: string
}

/** The visible information to retain when a list request fails. */
export type ListFailure = {
    readonly stale: boolean
    readonly note: string
}
