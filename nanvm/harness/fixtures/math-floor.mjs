// Native floor: ToNumber once, then round downward while preserving an input -0.
const { floor: detached } = Math;
const floor = /** @type {(value: unknown) => number} */ (detached);
const read = () => Math.floor;
const numbers = [NaN, Infinity, -Infinity, 0, -0, 1, -1, 1.9, -1.9, 0.5, -0.5,
    5e-324, -5e-324, 0x1_0000_0000 + 0.5, -0x1_0000_0000 - 0.5,
    0x20_0000_0000_0000, -0x20_0000_0000_0000, 1e100, -1e100];
const coercions = [undefined, null, true, false, '1.9', '-1.9', '-0', '', 'bad', 'Infinity',
    [], [1.9], [1n], {}, () => 1,
    // The number hint tries valueOf first and never reaches this toString.
    { valueOf: () => 2.9, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '-2.9' },
    { toString: () => '3.9' }];
export default [
    numbers.map(value => floor(value)),
    coercions.map(value => floor(value)),
    [Math.floor(1.9), Math['floor'](-1.9), Math.floor?.(-0.5), detached(2.9)],
    [Object.is(floor(-0), -0), Object.is(floor(-0.5), -1), Object.is(floor(-5e-324), -1), Object.is(floor(0.5), 0)],
    // @ts-expect-error — extra arguments are evaluated but not converted.
    Math.floor(1.9, 1n),
    // @ts-expect-error — the missing argument converts to NaN.
    Math.floor(),
    [detached === read(), read() === read(), typeof detached, detached.length, String(detached)],
];
