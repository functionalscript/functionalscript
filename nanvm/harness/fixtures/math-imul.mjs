// Native low-32-bit multiplication, after ordinary left-to-right conversion.
const { imul: detached } = Math;
const imul = /** @type {(a: unknown, b?: unknown) => number} */ (detached);
const read = () => Math.imul;
const pairs = [
    [2, 4], [-1, 8], [0xffff_ffff, 5], [0xffff_ffff, 0xffff_ffff],
    [0x7fff_ffff, 2], [0x8000_0000, -1], [0x8000_0000, 2], [0x1_0000, 0x1_0000],
    [0x1_0000_0001, 3], [-0x1_0000_0001, 3], [0x1f_ffff_ffff_ffff, 3],
    [0x20_0000_0000_0000, 3], [3.9, -2.9], [-3.9, 2.9],
    [NaN, 4], [4, NaN], [Infinity, -5], [-5, -Infinity],
    [0, -5], [-0, -5], [-5, -0], [5e-324, -5], [1.7976931348623157e308, 3],
];
const coercions = [undefined, null, true, false, '3.9', '-3.9', '-0', '', 'bad', 'Infinity',
    [], [3], [3n], {}, () => 1,
    { valueOf: () => 3, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '-3.9' },
    { toString: () => '4' }];
export default [
    pairs.map(([a, b]) => imul(a, b)),
    coercions.map(value => [imul(value, 5), imul(5, value)]),
    [Math.imul(2, 3), Math['imul'](3, 4), Math.imul?.(4, 5), detached(5, 6)],
    [Object.is(imul(-0, -5), 0), Object.is(imul(5, -0), 0), Object.is(imul(NaN, -1), 0)],
    // @ts-expect-error — extra values are not converted.
    Math.imul(2, 3, 1n),
    // @ts-expect-error — a missing operand converts to zero.
    Math.imul(3),
    // @ts-expect-error — both missing operands convert to zero.
    Math.imul(),
    [detached === read(), read() === read(), detached !== Math.sqrt, detached !== Math.ceil,
        typeof detached, detached.length, String(detached)],
];
