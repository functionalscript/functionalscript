/**
 * An inlined value region counts evaluation without a held mutable capture.
 * Boolean evaluates its operand exactly once and stays inside lazy branches.
 */
/** @type {(input: unknown) => readonly [boolean, number]} */
const once = input => {
    let count = 0;
    const converted = Boolean((() => {
        count = count + 1;
        return input;
    })());
    return [converted, count];
};
const fail = () => { throw "unreached Boolean operand"; };

export default [
    once(undefined), once(0), once(""), once(1), once([]),
    true || Boolean(fail()),
    false && Boolean(fail()),
    false ? Boolean(fail()) : true,
    Boolean(0) ? fail() : 7,
    Boolean([]) && Boolean(""),
];
