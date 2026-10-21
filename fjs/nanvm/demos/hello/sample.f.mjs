/**
 * Writes `hello, world` to standard output.
 *
 * The program is an effect: one `write` command, with the text as UTF-8
 * bytes in a bit vector. It is written out by hand because `fjs compile`
 * cannot compile `log` and `utf8` yet.
 *
 * @module
 */

/** `hello, world\n` as UTF-8. */
const greeting = -0xe8_656c_6c6f_2c20_776f_726c_640an

export default () => ({
    command: 'write',
    payload: ['stdout', greeting],
    continuation: () => () => ['ok', undefined],
})
