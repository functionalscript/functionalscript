/**
 * Types for `fjs/website/issue/module.f.mjs`: an issue's header as the
 * website reads it.
 *
 * @module
 */

import type { priorities, statuses } from './module.f.mjs'

/** One value of an issue's `**Status:**` line. */
export type Status = typeof statuses[number]

/** One value of an issue's `**Priority:**` line. */
export type Priority = typeof priorities[number]

/** The two fields of an issue's header the website reads. */
export type Header = {
    readonly status: Status
    readonly priority: Priority
}

/** One issue, as a directory's page lists it. */
export type Issue = {
    /**
     * The issue's path inside its `todo/`: `open.md`, or `blocked/later.md`
     * for one in a subfolder.
     */
    readonly name: string
    readonly status: Status
    readonly priority: Priority
}
