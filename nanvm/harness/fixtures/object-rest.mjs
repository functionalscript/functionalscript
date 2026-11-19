// Exclusion uses source keys; copies retain enumeration order and shallow identity.
const shared = { value: 17 };
const member = () => 23;
const source = /** @type {const} */ ({ "10": 10, "2": 2, 1: 1, drop: shared,
    alias: member, missing: undefined, ["__proto__"]: shared });
const { drop: alias, 1: first, drop: again, ...rest } = source;
const { ...copy } = source;
const { ...secondCopy } = source;
const { 0: arrayHead, ...arrayRest } = [shared, undefined, 7];
// JavaScript boxes strings and scalar primitives for object rest.
// @ts-expect-error — TypeScript restricts object-rest sources to object types.
const { ...text } = '😀a';
// @ts-expect-error — TypeScript restricts object-rest sources to object types.
const { ...number } = 3;
// @ts-expect-error — TypeScript restricts object-rest sources to object types.
const { ...boolean } = false;
// @ts-expect-error — TypeScript restricts object-rest sources to object types.
const { ...bigint } = 9n;
export default [
    [alias === shared, first, again === shared, rest.alias === member,
        copy !== source, copy !== secondCopy,
        copy.drop === shared, copy.alias === member, arrayHead === shared],
    Object.entries(rest).map(([key, value]) => [key, value === member ? 'member' : value]),
    Object.entries(arrayRest), Object.entries(text),
    [Object.entries(number), Object.entries(boolean), Object.entries(bigint)], shared,
];
