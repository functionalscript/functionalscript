/**
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 */
export const sgr
    : (c: number) => string
    = c => `\x1b[${c.toString()}m`

export const codes = {
    reset: sgr(0),
    bold: sgr(1),
    fgRed: sgr(31),
    fgGreen: sgr(32),
}
