// Native static: detached calls read no `this`; length is 1 despite variadic input.
const { fromCharCode } = String;
const read = () => String.fromCharCode;
const detached = () => {
    const { fromCharCode } = String;
    return fromCharCode(5, 6);
};
const units = [0, 0xffff, 0x1_0041, -1, -1.5, 65.9, NaN, Infinity, -Infinity, -0, 1e100];
const coercions = [undefined, null, true, false, '65', '', [], [66], {}, () => 1, { valueOf: () => 67 }, { valueOf: () => ({}), toString: () => '68' }];
export default [
    detached(), fromCharCode(), fromCharCode(5), fromCharCode(5, 6, 7),
    fromCharCode(...units), units.map(unit => fromCharCode(unit)),
// @ts-expect-error — exercise JavaScript ToNumber beyond the TypeScript number signature.
    coercions.map(value => fromCharCode(value)),
    fromCharCode(0xd800), fromCharCode(0xdc00), fromCharCode(0xd83d, 0xde00),
    [fromCharCode.length, String.fromCharCode.length, fromCharCode === read(), read() === read(), typeof fromCharCode, String(fromCharCode)],
];
