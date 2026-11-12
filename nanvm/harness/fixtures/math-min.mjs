// Native minimum converts every argument, including after NaN or infinity.
const { min: detached } = Math;
const min = /** @type {(...values: readonly unknown[]) => number} */ (detached);
const read = () => Math.min;
const groups = [
    [], [-Infinity], [Infinity], [NaN], [0], [-0], [-0, -0], [0, -0], [-0, 0],
    [-0, -0, 0, -0], [0, -0, -0], [-1, 3, 2, 5, 4], [5, 3, 4],
    [-Infinity, -1, Infinity, 3], [NaN, 3], [3, NaN], [3, NaN, 4],
    [-Infinity, NaN], [NaN, -Infinity], [5e-324, -5e-324],
    [1.7976931348623157e308, -1.7976931348623157e308],
];
const coercions = [undefined, null, true, false, '4', '-4', '-0', '', 'bad', 'Infinity', '-Infinity',
    [], [9], [9n], {}, () => 1,
    { valueOf: () => 16, toString: () => { throw 'must not convert'; } },
    { valueOf: () => ({}), toString: () => '25' },
    { toString: () => '36' }];
export default [
    groups.map(values => min(...values)),
    coercions.map(value => [min(value), min(Infinity, value), min(value, Infinity)]),
    [Math.min(1, 3, 2), Math['min'](4, 2, 5), Math.min?.(6, 7, 1), detached(3, 9, 4)],
    [Object.is(min(-0, -0), -0), Object.is(min(0, -0), -0), Object.is(min(-0, 0), -0),
        Object.is(min(), Infinity), Object.is(min(NaN, -Infinity), NaN)],
    [detached === read(), read() === read(), detached !== Math.sqrt, detached !== Math.ceil,
        detached !== Math.imul, detached !== Math.max, typeof detached, detached.length, String(detached)],
];
