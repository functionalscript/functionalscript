type End = 'm'

/**
 * Control Sequence Introducer (CSI) escape sequence.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#Control_Sequence_Introducer_commands
 *
 * @param end - The final character that indicates the type of sequence.
 * @returns A function that takes a code (number or string) and returns the complete ANSI escape sequence.
 */
export const csi = (end: End) => (code: number | string): string =>
    `\x1b[${code.toString()}${end}`

/**
 * Specialization of CSI for Select Graphic Rendition (SGR) sequences.
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 */
export const sgr = csi('m')

export const reset: string = sgr(0)
export const bold: string = sgr(1)
export const fgRed: string = sgr(31)
export const fgGreen: string = sgr(32)
