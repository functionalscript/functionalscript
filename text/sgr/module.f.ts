/**
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 */
export const sgr = (c: number): string => `\x1b[${c.toString()}m`

export const reset: string = sgr(0)
export const bold: string = sgr(1)
export const fgRed: string = sgr(31)
export const fgGreen: string = sgr(32)
