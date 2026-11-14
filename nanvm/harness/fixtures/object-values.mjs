/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_values.rs`, committed
 * and drift-checked by `npm run gen`. The cross-executor corpus compares the
 * common runtime's projection of native entries with JavaScript.
 */
const { values } = Object;
const child = /** @type {const} */ ({ nested: 7 });
const source = /** @type {const} */ ({ b: child, "10": 2, "2": 3, u: undefined, ["__proto__"]: child, "01": 5, a: 6 });
const inputs = /** @type {const} */ ([source, [7, child], "a😀\ud800", "", 1, true, 1n, () => 0, {}, Object.values]);
const read = () => Object.values;
const throwsIfCalled = () => { throw 7; };
const references = values({ child, again: child, fn: throwsIfCalled });
export default [
    inputs.map(v => values(v)),
    inputs.map(values),
    Object["values"](source),
    Object.values?.(source),
    values({ ...source, b: 9, z: undefined }),
    values({ constructor: 1, toString: 2, ["__proto__"]: 3 }),
    [read() === read(), values === Object.values, values === Object["values"], typeof Object.values, Object.values.length, String(Object.values)],
    [values(source) === values(source), values([]) === values([]), values("") === values("")],
    [references[0] === child, references[0] === references[1], references[2] === throwsIfCalled],
    (() => {
        let order = 0;
        // @ts-expect-error — the extra argument is evaluated, then ignored.
        const result = values((() => { order = order * 10 + 1; return { kept: 7 }; })(), (() => { order = order * 10 + 2; return 0; })());
        return [result, order];
    })(),
];
