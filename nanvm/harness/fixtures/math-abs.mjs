// Native absolute value: ToNumber once, then preserve magnitude and clear its sign.
const { abs: detached } = Math;
const abs = /** @type {(value: unknown) => number} */ (detached);
const read = () => Math.abs;
const numbers = [NaN, Infinity, -Infinity, 0, -0, 1, -1, 1.9, -1.9, 0.5, -0.5,
    5e-324, -5e-324, 0x1_0000_0000 + 0.5, -0x1_0000_0000 - 0.5,
    0x20_0000_0000_0000, -0x20_0000_0000_0000, 1.7976931348623157e308, -1.7976931348623157e308];
const coercions = [undefined, null, true, false, '1.9', '-1.9', '-0', '', 'bad', '-Infinity',
    [], [-1.9], [-1n], {}, () => 1,
    // The number hint tries valueOf first and never reaches this toString.
    { valueOf: () => -2.9, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '-2.9' },
    { toString: () => '-3.9' }];
export default [
    numbers.map(value => abs(value)),
    coercions.map(value => abs(value)),
    [Math.abs(-1.9), Math['abs'](-0.5), Math.abs?.(-5e-324), detached(-2.9)],
    [Object.is(abs(-0), 0), Object.is(abs(-5e-324), 5e-324), Object.is(abs(5e-324), 5e-324), Object.is(abs(-Infinity), Infinity)],
    // @ts-expect-error — extra arguments are evaluated but not converted.
    Math.abs(-1.9, 1n),
    // @ts-expect-error — the missing argument converts to NaN.
    Math.abs(),
    [detached === read(), read() === read(), detached !== Math.trunc, detached !== Math.floor, typeof detached, detached.length, String(detached)],
];
