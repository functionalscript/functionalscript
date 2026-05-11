/**
 * ANSI Control Sequence Introducer (CSI) and Select Graphic Rendition (SGR)
 * helpers for writing formatted terminal output and TTY-aware console streams.
 *
 * @module
 */

// C0 control codes
// https://en.wikipedia.org/wiki/ANSI_escape_code#C0_control_codes

import type { Io, Writable } from "../../io/module.f.ts"

export const backspace: string = '\x08'

//

type End = 'm'

type Csi = (code: number | string) => string

const begin = '\x1b['

/**
 * Control Sequence Introducer (CSI) escape sequence.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#Control_Sequence_Introducer_commands
 *
 * @param end - The final character that indicates the type of sequence.
 * @returns A function that takes a code (number or string) and returns the complete ANSI escape sequence.
 */
export const csi = (end: End): Csi => code =>
    `${begin}${code.toString()}${end}`

/**
 * Specialization of CSI for Select Graphic Rendition (SGR) sequences.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 */
export const sgr: Csi = csi('m')

/** Resets all SGR styles to terminal defaults. */
export const reset: string = sgr(0)
/** Enables bold/intense text rendering when supported by the terminal. */
export const bold: string = sgr(1)
/** Applies red foreground color to subsequent text. */
export const fgRed: string = sgr(31)
/** Applies green foreground color to subsequent text. */
export const fgGreen: string = sgr(32)

const { max } = Math

const replace = (old: string) => (text: string) => {
    const len = old.length
    const suffixLength = max(0, len - text.length)
    return backspace.repeat(len) + text + " ".repeat(suffixLength) + backspace.repeat(suffixLength)
}

export type Stdout = {
    /** Writes a string to the output stream. */
    readonly write: (s: string) => void
}

/** Stateful writer that updates previously printed text in-place. */
export type WriteText = (text: string) => WriteText

/**
 * Creates a stateful text writer that rewrites the previous value using backspaces.
 *
 * @param stdout - Destination output stream.
 * @returns A recursive writer that replaces prior text on each call.
 */
export const createConsoleText = (stdout: Stdout): WriteText => {
    const f = (old: string) => (text: string) => {
        stdout.write(replace(old)(text))
        return f(text)
    }
    return f('')
}

export type CsiConsole = (s: string) => void

/**
 * Creates a TTY-aware console function.
 *
 * For TTY destinations, ANSI SGR sequences are preserved.
 * For non-TTY destinations, ANSI SGR sequences are stripped.
 *
 * @param io - Runtime IO bindings.
 * @returns A function that targets a writable stream.
 */
export const console = ({ fs: { writeSync } }: Io) => (w: Writable): CsiConsole => {
    const { isTTY } = w
    return isTTY
        ? (s: string) => writeSync(w.fd, s + '\n')
        : (s: string) => writeSync(w.fd, s.replace(/\x1b\[[0-9;]*m/g, '') + '\n')
}

/** Writes to process stdout using a TTY-aware CSI console. */
export const stdio = (io: Io): CsiConsole => console(io)(io.process.stdout)

/** Writes to process stderr using a TTY-aware CSI console. */
export const stderr = (io: Io): CsiConsole => console(io)(io.process.stderr)
