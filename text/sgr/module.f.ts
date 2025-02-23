type End = 'm'

/**
 * https://en.wikipedia.org/wiki/ANSI_escape_code#Control_Sequence_Introducer_commands
 */
export const csi = (c: number, end: End): string => `\x1b[${c.toString()}${end}`

/**
 * Select Graphic Rendition (SGR) parameters.
 *
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 */
export const sgr = (c: number): string => csi(c, 'm')

export const reset: string = sgr(0)
export const bold: string = sgr(1)
export const fgRed: string = sgr(31)
export const fgGreen: string = sgr(32)
