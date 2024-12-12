// @ts-self-types="./module.f.d.mts"

/**
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 *
 * @type {(c: number) => string}
 */
export const sgr = c => `\x1b[${c.toString()}m`

export const codes = {
    /** @readonly */
    reset: sgr(0),
    /** @readonly */
    bold: sgr(1),
    /** @readonly */
    fgRed: sgr(31),
    /** @readonly */
    fgGreen: sgr(32),
}
