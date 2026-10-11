/**
 * Compiled by `fjs compile` into `../gen.fixtures/console.rs`, committed and
 * drift-checked by `npm run gen`. The console half of the parity corpus that
 * `parity.mjs` begins: programs a host performs, here against standard streams
 * rather than a directory. `../tests/console.rs` performs them on
 * `nanvm-effects-node` over buffers, and `../../../fjs/nanvm/parity/console.proof.mjs`
 * on the Node runner in a child process whose streams it holds; both must
 * answer what a case says.
 *
 * A case is `{ run, input, expected, stdout, stderr }`. `run()` is an effect
 * that ends `['ok', answers]`, one raw answer per operation. `input` is the
 * bytes the program reads from standard input, `expected` the answers, and
 * `stdout` and `stderr` the bytes the program writes, all as arrays of
 * numbers. Bytes a program writes are `Vec`s, the bits with a stop bit in
 * front, negated where the first was `0` (`fjs/types/bit_vec`).
 */

const hi = -0xe869n;
const hihi = -0xe869_6869n;

/**
 * The answers of a chain of operations, in order. An operation with no value
 * answers `['ok', undefined]`, which JSON cannot hold: it is `['ok', null]` here.
 *
 * @type {(commands: readonly (readonly [string, readonly unknown[]])[]) => (acc: readonly unknown[]) => unknown}
 */
const chain = commands => acc =>
    commands.length === 0
        ? () => ['ok', acc]
        : {
            command: commands[0][0],
            payload: commands[0][1],
            continuation: (/** @type {any} */ answer) => chain(commands.slice(1))([...acc, answer[1] === undefined ? ['ok', null] : answer]),
        };

export const echo = {
    run: () => chain([
        ['write', ['stdout', hi]],
        ['write', ['stderr', hihi]],
        ['write', ['stdout', hihi]],
        ['read', ['stdin']],
        ['read', ['stdin']],
        ['read', ['stdin']],
        ['read', ['stdin']],
    ])([]),
    input: [0x68, 0x69, 0xff],
    expected: [['ok', null], ['ok', null], ['ok', null], ['ok', 0x68], ['ok', 0x69], ['ok', 0xff], ['ok', null]],
    stdout: [0x68, 0x69, 0x68, 0x69, 0x68, 0x69],
    stderr: [0x68, 0x69, 0x68, 0x69],
};

export const noInput = {
    run: () => chain([['read', ['stdin']], ['read', ['stdin']]])([]),
    input: [],
    expected: [['ok', null], ['ok', null]],
    stdout: [],
    stderr: [],
};
