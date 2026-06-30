/**
 * ANSI Control Sequence Introducer (CSI) and Select Graphic Rendition (SGR)
 * helpers for writing formatted terminal output and TTY-aware console streams.
 *
 * @module
 */

// C0 control codes
// https://en.wikipedia.org/wiki/ANSI_escape_code#C0_control_codes

import { write, type Write, type WriteConsoles, type NodeProgramOptions } from '../../effects/node/module.f.ts'
import { pure, type Effect } from '../../effects/module.f.ts'
import { utf8 } from "../module.f.ts"

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

const str = (isTTY: boolean) => (s: string) =>
    isTTY ? s : s.replace(/\x1b\[[0-9;]*m/g, '')

/**
 * Effect-based TTY-aware write. Strips ANSI SGR sequences when the target
 * stream is not a TTY, then encodes to UTF-8 and emits a `Write` effect.
 * Does NOT append `\n` — callers are responsible for line termination.
 */
export const csiWrite =
    ({ std }: NodeProgramOptions) =>
    (stream: WriteConsoles):
    (s: string) => Effect<Write, void> =>
{
    const toStr = str(std[stream].isTTY)
    return (s: string): Effect<Write, void> => {
        const v = utf8(toStr(s))
        // The `write` primitive takes a single `Vec`; output whose UTF-8
        // encoding exceeds `maxLength` is currently unencodable, so drop it
        // rather than throw. The durable fix is a chunked-stream `write`.
        return v === null ? pure(undefined) : write(stream, v)
    }
}
