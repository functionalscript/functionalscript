// Native ceiling, including negative fractions returning negative zero.
const { ceil: detached } = Math;
const ceil = /** @type {(value: unknown) => number} */ (detached);
const read = () => Math.ceil;
const numbers = [NaN, Infinity, -Infinity, 0, -0, 1, -1, 1.9, -1.9, 0.5, -0.5,
    5e-324, -5e-324, 0x1_0000_0000 + 0.5, -0x1_0000_0000 - 0.5,
    0x20_0000_0000_0000, -0x20_0000_0000_0000, 1.7976931348623157e308, -1.7976931348623157e308];
const coercions = [undefined, null, true, false, '1.9', '-1.9', '-0', '', 'bad', '-Infinity',
    [], [-1.9], [-1n], {}, () => 1,
    { valueOf: () => -2.9, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '-2.9' },
    { toString: () => '3.9' }];
export default [
    numbers.map(value => ceil(value)),
    coercions.map(value => ceil(value)),
    [Math.ceil(1.9), Math['ceil'](-1.9), Math.ceil?.(-0.5), detached(2.9)],
    [Object.is(ceil(-0), -0), Object.is(ceil(-0.5), -0), Object.is(ceil(-5e-324), -0), Object.is(ceil(0.5), 1)],
    // @ts-expect-error — extra values are not converted.
    Math.ceil(-1.9, 1n),
    // @ts-expect-error — a missing input converts to NaN.
    Math.ceil(),
    [detached === read(), read() === read(), detached !== Math.sqrt, detached !== Math.imul,
        typeof detached, detached.length, String(detached)],
];
