/**
 * ANSI Control Sequence Introducer (CSI) and Select Graphic Rendition (SGR)
 * helpers for writing formatted terminal output and TTY-aware console streams.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Console, Std, Write, WriteConsoles } from '../../effects/common/types.ts'
 * @import { Stdout, WriteText, CsiConsole } from './types.ts'
 */

// C0 control codes
// https://en.wikipedia.org/wiki/ANSI_escape_code#C0_control_codes

import { write } from '../../effects/common/module.f.mjs'
import { utf8 } from "../module.f.mjs"
import { isDigit, latinSmallLetterM, leftSquareBracket, semicolon } from '../ascii/module.f.mjs'

/** @type {string} */
export const backspace = '\x08'

//

/** @type {string} */
const esc = '\x1b'

const begin = `${esc}[`

/**
 * Control Sequence Introducer (CSI) escape sequence.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#Control_Sequence_Introducer_commands
 *
 * @param end - The final character that indicates the type of sequence.
 * @returns A function that takes a code (number or string) and returns the complete ANSI escape sequence.
 *
 * @type {(end: 'm') => (code: number | string) => string}
 */
export const csi = end => code =>
    `${begin}${code.toString()}${end}`

/**
 * Specialization of CSI for Select Graphic Rendition (SGR) sequences.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 *
 * @type {(code: number | string) => string}
 */
export const sgr = csi('m')

/** Resets all SGR styles to terminal defaults. */
export const reset = sgr(0)
/** Enables bold/intense text rendering when supported by the terminal. */
export const bold = sgr(1)
/** Applies red foreground color to subsequent text. */
export const fgRed = sgr(31)
/** Applies green foreground color to subsequent text. */
export const fgGreen = sgr(32)

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

/** A character of an SGR parameter list: a decimal digit or `;`. @type {(c: number) => boolean} */
const isParameter = c => isDigit(c) || c === semicolon

/**
 * Removes the SGR sequence that `chunk`, the text after an `ESC`, begins
 * with, or restores the `ESC` when it does not begin one.
 *
 * @type {(chunk: string) => string}
 */
const afterEscape = chunk => {
    if (chunk.charCodeAt(0) !== leftSquareBracket) { return esc + chunk }
    let i = 1
    while (isParameter(chunk.charCodeAt(i))) { i += 1 }
    return chunk.charCodeAt(i) === latinSmallLetterM ? chunk.slice(i + 1) : esc + chunk
}

/**
 * Removes every SGR sequence — `ESC [`, a run of decimal digits and `;`, then
 * `m` — from `s`, and keeps everything else, including an `ESC` that does not
 * begin one.
 *
 * A sequence contains no `ESC` after its first character, so splitting on
 * `ESC` puts each one at the start of its own chunk.
 *
 * @type {(s: string) => string}
 */
export const stripSgr = s => {
    const [first, ...rest] = s.split(esc)
    return [first, ...rest.map(afterEscape)].join('')
}

/** @type {(isTTY: boolean) => (s: string) => string} */
const str = isTTY => isTTY ? s => s : stripSgr

/**
 * Effect-based TTY-aware write. Strips ANSI SGR sequences when the target
 * stream is not a TTY, then encodes to UTF-8 and emits a `Write` effect.
 * Does NOT append `\n` — callers are responsible for line termination.
 *
 * It takes a {@link Std} rather than a whole program's options: what it needs
 * to know is whether each stream is a TTY, and asking for the rest made an
 * ANSI-sequence helper name a host it has nothing to do with.
 *
 * @type {(std: Std) => (stream: WriteConsoles) => Console}
 */
export const csiWrite = std => stream => {
    const toStr = str(std[stream].isTTY)
    return s => write(stream, utf8(toStr(s)))
}
