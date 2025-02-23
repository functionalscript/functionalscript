// Co control codes
// https://en.wikipedia.org/wiki/ANSI_escape_code#C0_control_codes

export const backspace: string = '\x08'

//

type End = 'm'

type Csi = (code: number | string) => string

/**
 * Control Sequence Introducer (CSI) escape sequence.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#Control_Sequence_Introducer_commands
 *
 * @param end - The final character that indicates the type of sequence.
 * @returns A function that takes a code (number or string) and returns the complete ANSI escape sequence.
 */
export const csi = (end: End): Csi => code =>
    `\x1b[${code.toString()}${end}`

/**
 * Specialization of CSI for Select Graphic Rendition (SGR) sequences.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 */
export const sgr: Csi = csi('m')

export const reset: string = sgr(0)
export const bold: string = sgr(1)
export const fgRed: string = sgr(31)
export const fgGreen: string = sgr(32)

const { max } = Math

const replace = (old: string) => (text: string) => {
    const len = old.length
    const suffixLength = max(0, len - text.length)
    return backspace.repeat(len) + text + " ".repeat(suffixLength) + backspace.repeat(suffixLength)
}

export type Stdout = {
    readonly write: (s: string) => void
}

export type WriteText = (text: string) => WriteText

export const createConsoleText = (stdout: Stdout): WriteText => {
    const f = (old: string) => (text: string) => {
        stdout.write(replace(old)(text))
        return f(text)
    }
    return f('')
}
