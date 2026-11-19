// Native maximum converts every argument, including after NaN or infinity.
const { max: detached } = Math;
const max = /** @type {(...values: readonly unknown[]) => number} */ (detached);
const read = () => Math.max;
const groups = [
    [], [-Infinity], [Infinity], [NaN], [0], [-0], [-0, -0], [0, -0], [-0, 0],
    [-0, -0, 0, -0], [0, -0, -0], [-1, 3, 2, 5, 4], [5, 3, 4],
    [-Infinity, -1, Infinity, 3], [NaN, 3], [3, NaN], [3, NaN, 4],
    [Infinity, NaN], [NaN, Infinity], [5e-324, -5e-324],
    [1.7976931348623157e308, -1.7976931348623157e308],
];
const coercions = [undefined, null, true, false, '4', '-4', '-0', '', 'bad', 'Infinity',
    [], [9], [9n], {}, () => 1,
    { valueOf: () => 16, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '25' },
    { toString: () => '36' }];
export default [
    groups.map(values => max(...values)),
    coercions.map(value => [max(value), max(-Infinity, value), max(value, -Infinity)]),
    [Math.max(1, 3, 2), Math['max'](4, 2, 5), Math.max?.(6, 7, 1), detached(3, 9, 4)],
    [Object.is(max(-0, -0), -0), Object.is(max(0, -0), 0), Object.is(max(-0, 0), 0),
        Object.is(max(), -Infinity), Object.is(max(NaN, Infinity), NaN)],
    [detached === read(), read() === read(), detached !== Math.sqrt, detached !== Math.ceil,
        detached !== Math.imul, typeof detached, detached.length, String(detached)],
];
