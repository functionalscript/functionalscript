// Native square root, including domain errors and the sign of zero.
const { sqrt: detached } = Math;
const sqrt = /** @type {(value: unknown) => number} */ (detached);
const read = () => Math.sqrt;
const numbers = [NaN, Infinity, -Infinity, 0, -0, 1, -1, 4, -4, 2, 9, 0.25, -0.25,
    5e-324, -5e-324, 2.2250738585072014e-308, 1.7976931348623157e308,
    0.9999999999999999, 1.0000000000000002, 0x1_0000_0000, 0x20_0000_0000_0000];
const coercions = [undefined, null, true, false, '4', '-4', '-0', '', 'bad', 'Infinity',
    [], [9], [9n], {}, () => 1,
    { valueOf: () => 16, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '25' },
    { toString: () => '36' }];
export default [
    numbers.map(value => sqrt(value)),
    coercions.map(value => sqrt(value)),
    [Math.sqrt(4), Math['sqrt'](9), Math.sqrt?.(0.25), detached(16)],
    [Object.is(sqrt(-0), -0), Object.is(sqrt(0), 0), Object.is(sqrt(-1), NaN), Object.is(sqrt(-Infinity), NaN)],
    // @ts-expect-error — extra values are not converted.
    Math.sqrt(4, 1n),
    // @ts-expect-error — a missing input converts to NaN.
    Math.sqrt(),
    [detached === read(), read() === read(), detached !== Math.ceil, detached !== Math.imul,
        typeof detached, detached.length, String(detached)],
];
