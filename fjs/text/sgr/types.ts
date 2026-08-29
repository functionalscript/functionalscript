/**
 * Types for ANSI CSI/SGR terminal output helpers.
 *
 * @module
 */

export type Stdout = {
    /** Writes a string to the output stream. */
    readonly write: (s: string) => void
}

/** Stateful writer that updates previously printed text in-place. */
export type WriteText = (text: string) => WriteText

export type CsiConsole = (s: string) => void
