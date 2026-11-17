// The common runtime's rounding: a tie toward positive infinity, and
// negative zero for a value from -0.5 up to zero.
const { round: detached } = Math;
const round = /** @type {(value: unknown) => number} */ (detached);
const read = () => Math.round;
const numbers = [NaN, Infinity, -Infinity, 0, -0, 1, -1, 0.5, -0.5, 1.5, -1.5, 2.5, -2.5,
    0.4, -0.4, 0.6, -0.6, 0.49999999999999994, -0.49999999999999994, -0.5000000000000001,
    5e-324, -5e-324, 0x1_0000_0000 + 0.5, -0x1_0000_0000 - 0.5,
    4503599627370495.5, -4503599627370495.5, 0x10_0000_0000_0001, -0x10_0000_0000_0001,
    0x20_0000_0000_0000, 1.7976931348623157e308, -1.7976931348623157e308];
const coercions = [undefined, null, true, false, '2.5', '-2.5', '-0', '', 'bad', '-Infinity',
    [], [-1.5], [-1n], {}, () => 1,
    { valueOf: () => -2.5, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '-3.5' },
    { toString: () => '3.5' }];
export default [
    numbers.map(value => round(value)),
    coercions.map(value => round(value)),
    [Math.round(2.5), Math['round'](-2.5), Math.round?.(-0.5), detached(3.5)],
    [Object.is(round(-0), -0), Object.is(round(-0.5), -0), Object.is(round(-0.2), -0),
        Object.is(round(-5e-324), -0), Object.is(round(0.4), 0), Object.is(round(0.49999999999999994), 0)],
    // @ts-expect-error — extra values are not converted.
    Math.round(-2.5, 1n),
    // @ts-expect-error — a missing input converts to NaN.
    Math.round(),
    [detached === read(), read() === read(), detached !== Math.floor, detached !== Math.ceil,
        typeof detached, detached.length, String(detached)],
];
