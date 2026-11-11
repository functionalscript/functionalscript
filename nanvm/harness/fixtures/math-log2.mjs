// The runtime body serves the represented executor and Rust. Exact powers,
// conversion, metadata and approximate nonpowers all use the same source
// against JavaScript's independent built-in.
const { log2: detached } = Math;
const log2 = /** @type {(value: unknown) => number} */ (detached);
const read = () => Math.log2;
const powers = [5e-324, 2 ** -1022, 2 ** -512, 0.5, 1, 2, 8, 2 ** 512, 2 ** 1023];
const coercions = [undefined, null, true, false, '8', '0.5', 'bad', '', [], [8], [8n], {}, () => 1,
    { valueOf: () => 8 },
    { valueOf: () => ({}), toString: () => '4' },
    { valueOf: () => 2, toString: () => { throw 'must not convert'; } }];
/** @type {(actual: number, expected: number) => boolean} */
const close = (actual, expected) => actual - expected < 1e-12 && expected - actual < 1e-12;
/** @type {(input: number, expected: number, ulp: number) => boolean} */
const accurate = (input, expected, ulp) => {
    const difference = log2(input) - expected;
    return -2 * ulp <= difference && difference <= 2 * ulp;
};
export default [
    powers.map(value => log2(value)),
    [NaN, -1, -Infinity, Infinity, 0, -0].map(value => log2(value)),
    coercions.map(value => log2(value)),
    [Math.log2(8), Math['log2'](4), Math.log2?.(2), detached(0.5)],
    // Extra arguments are ignored, including a BigInt that would fail conversion.
    // @ts-expect-error — JavaScript ignores the extra argument.
    Math.log2(8, 1n),
    // @ts-expect-error — JavaScript converts the missing argument to NaN.
    Math.log2(),
    [Object.is(log2(1), 0), detached === read(), read() === read(), typeof detached, detached.length, String(detached)],
    [close(log2(1.5), 0.5849625007211562), close(log2(10), 3.321928094887362), close(log2(1e-300), -996.5784284662087)],
    [accurate(0.9999999999999999, -1.6017132519074588e-16, 2.465190328815662e-32),
        accurate(1.0000000000000002, 3.203426503814917e-16, 4.930380657631324e-32),
        accurate(1.4142135623730951, 0.5000000000000001, 1.1102230246251565e-16),
        accurate(1.414213562373095, 0.4999999999999999, 5.551115123125783e-17)],
];
