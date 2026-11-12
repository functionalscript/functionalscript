// One source exercises the common bodies in the interpreter and generated Rust.
const shared = /** @type {const} */ ({ value: 1 });
const nested = /** @type {const} */ ([2]);
const receiver = /** @type {readonly unknown[]} */ ([shared]);
const appended = receiver.concat([nested], 3);
const own = /** @type {const} */ ({
    concat: (/** @type {unknown} */ a, /** @type {unknown} */ b) => ['own', a, b],
});
const absent = /** @type {{ readonly concat?: (value: unknown) => unknown }} */ ({});
const fail = () => { throw 'optional concat argument'; };
const text = /** @type {const} */ ({
    toString: () => 'text',
    valueOf: () => { throw 'string hint must prefer toString'; },
});
const fallback = /** @type {const} */ ({ toString: () => ({}), valueOf: () => 7 });

export default [
    [].concat(),
    receiver.concat(undefined),
    [receiver.concat() !== receiver, receiver.concat()[0] === shared],
    [appended[0] === shared, appended[1] === nested, appended],
    own.concat(4, [5]),
    absent.concat?.(fail()),
    ''.concat(),
    'a'.concat('b', 'c'),
    // @ts-expect-error — exercise ToString for non-string arguments.
    ''.concat(1, 2n, null, undefined, true, ['x'], text, fallback),
];
