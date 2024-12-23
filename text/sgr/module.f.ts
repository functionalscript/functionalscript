/**
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 */
export const sgr
: (c: number) => string
= c => `\x1b[${c.toString()}m`

export const reset = sgr(0)
export const bold = sgr(1)
export const fgRed = sgr(31)
export const fgGreen = sgr(32)
