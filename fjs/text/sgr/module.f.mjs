/**
 * ANSI Control Sequence Introducer (CSI) and Select Graphic Rendition (SGR)
 * helpers for writing formatted terminal output and TTY-aware console streams.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 */

// C0 control codes
// https://en.wikipedia.org/wiki/ANSI_escape_code#C0_control_codes

import { write } from '../../effects/node/module.f.mjs'
/** @import { Write, WriteConsoles, NodeProgramOptions } from '../../effects/node/types.ts' */
/** @import { Effect } from '../../effects/types.ts' */
import { utf8 } from "../module.f.mjs"
/** @import { Stdout, WriteText, CsiConsole } from './types.ts' */

/** @type {string} */
export const backspace = '\x08'

//

/** @typedef {'m'} _End */

/** @typedef {(code: number | string) => string} _Csi */

const begin = '\x1b['

/**
 * Control Sequence Introducer (CSI) escape sequence.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#Control_Sequence_Introducer_commands
 *
 * @param end - The final character that indicates the type of sequence.
 * @returns A function that takes a code (number or string) and returns the complete ANSI escape sequence.
 *
 * @type {(end: _End) => _Csi}
 */
export const csi = end => code =>
    `${begin}${code.toString()}${end}`

/**
 * Specialization of CSI for Select Graphic Rendition (SGR) sequences.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 *
 * @type {_Csi}
 */
export const sgr = csi('m')

/** Resets all SGR styles to terminal defaults. */
export const reset = /** @type {string} */ (sgr(0))
/** Enables bold/intense text rendering when supported by the terminal. */
export const bold = /** @type {string} */ (sgr(1))
/** Applies red foreground color to subsequent text. */
export const fgRed = /** @type {string} */ (sgr(31))
/** Applies green foreground color to subsequent text. */
export const fgGreen = /** @type {string} */ (sgr(32))

const { max } = Math

/** @type {(old: string) => (text: string) => string} */
const replace = old => text => {
    const len = old.length
    const suffixLength = max(0, len - text.length)
    return backspace.repeat(len) + text + " ".repeat(suffixLength) + backspace.repeat(suffixLength)
}

/**
 * Creates a stateful text writer that rewrites the previous value using backspaces.
 *
 * @param stdout - Destination output stream.
 * @returns A recursive writer that replaces prior text on each call.
 *
 * @type {(stdout: Stdout) => WriteText}
 */
export const createConsoleText = stdout => {
    /** @type {(old: string) => WriteText} */
    const f = old => text => {
        stdout.write(replace(old)(text))
        return f(text)
    }
    return f('')
}

/** @type {(isTTY: boolean) => (s: string) => string} */
const str = isTTY => s =>
    isTTY ? s : s.replace(/\x1b\[[0-9;]*m/g, '')

/**
 * Effect-based TTY-aware write. Strips ANSI SGR sequences when the target
 * stream is not a TTY, then encodes to UTF-8 and emits a `Write` effect.
 * Does NOT append `\n` — callers are responsible for line termination.
 *
 * @type {(options: NodeProgramOptions) => (stream: WriteConsoles) => (s: string) => Effect<Write, void>}
 */
export const csiWrite = ({ std }) => stream => {
    const toStr = str(std[stream].isTTY)
    return s => write(stream, utf8(toStr(s)))
}
