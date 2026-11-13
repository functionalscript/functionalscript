// Native truncation: ToNumber once, then round toward zero without losing -0.
const { trunc: detached } = Math;
const trunc = /** @type {(value: unknown) => number} */ (detached);
const read = () => Math.trunc;
const numbers = [NaN, Infinity, -Infinity, 0, -0, 1, -1, 1.9, -1.9, 0.9, -0.9,
    5e-324, -5e-324, 0x20_0000_0000_0000, -0x20_0000_0000_0000, 1e100, -1e100];
const coercions = [undefined, null, true, false, '1.9', '-1.9', '-0', '', 'bad', 'Infinity',
    [], [1.9], [1n], {}, () => 1,
    // The number hint tries valueOf first and never reaches this toString.
    { valueOf: () => 2.9, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '-2.9' },
    { toString: () => '3.9' }];
export default [
    numbers.map(value => trunc(value)),
    coercions.map(value => trunc(value)),
    [Math.trunc(1.9), Math['trunc'](-1.9), Math.trunc?.(-0.9), detached(2.9)],
    [Object.is(trunc(-0), -0), Object.is(trunc(-0.9), -0), Object.is(trunc(-5e-324), -0), Object.is(trunc(0.9), 0)],
    // @ts-expect-error — extra arguments are evaluated but not converted.
    Math.trunc(1.9, 1n),
    // @ts-expect-error — the missing argument converts to NaN.
    Math.trunc(),
    [detached === read(), read() === read(), typeof detached, detached.length, String(detached)],
];
