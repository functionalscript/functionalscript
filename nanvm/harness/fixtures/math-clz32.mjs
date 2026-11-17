// Native leading-zero count of the ToUint32 value: zero has thirty-two.
const { clz32: detached } = Math;
const clz32 = /** @type {(value: unknown) => number} */ (detached);
const read = () => Math.clz32;
const numbers = [NaN, Infinity, -Infinity, 0, -0, 1, 2, 3, 0xff, 0x100, 0xffff, 0x1_0000,
    0x7fff_ffff, 0x8000_0000, 0xffff_ffff, -1, -0x8000_0000, -0xffff_ffff,
    0x1_0000_0000, 0x1_0000_0001, 0x20_0000_0000_0000, 1.9, -1.9, 0.5, -0.5,
    5e-324, 1.7976931348623157e308];
const coercions = [undefined, null, true, false, '1', '-1', '0x10', '', 'bad', '-Infinity',
    [], [8.9], [8n], {}, () => 1,
    { valueOf: () => 2.9, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '-1' },
    { toString: () => '255' }];
export default [
    numbers.map(value => clz32(value)),
    coercions.map(value => clz32(value)),
    [Math.clz32(1), Math['clz32'](0x8000_0000), Math.clz32?.(-1), detached(0xffff)],
    [clz32(0) === 32, clz32(-0) === 32, clz32(0.5) === 32, clz32(0x1_0000_0001) === 31],
    // @ts-expect-error — extra values are not converted.
    Math.clz32(1, 1n),
    // @ts-expect-error — a missing input converts to NaN, and that to zero.
    Math.clz32(),
    [detached === read(), read() === read(), detached !== Math.ceil, detached !== Math.imul,
        typeof detached, detached.length, String(detached)],
];
