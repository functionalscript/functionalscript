// The global is one callable common-runtime function, including detached and
// callback calls. The corpus compares these values with JavaScript's built-in.
const encode = /** @type {(value?: unknown, ...ignored: readonly unknown[]) => string} */ (encodeURIComponent);
const read = () => encodeURIComponent;
const strings = /** @type {const} */ ([
    '', "AZaz09-_.!~*'()", ' /?:@&=+$,#%[]', '\u0000\t\n\r\u001f',
    '\u007f', '\u0080', '\u07ff', '\u0800', '\ud7ff', '\ue000', '\uffff',
    '\ud800\udc00', '\udbff\udfff', 'П/雪 😀', 'a%20/😀\u0000雪!',
]);
const coercions = /** @type {const} */ ([
    undefined, null, true, false, 0, -0, 1.5, NaN, Infinity, -Infinity,
    1n, -2n, [], [undefined, null], [1, 'a b', ['雪']], {}, { a: 1 },
    { toString: () => 'x / 雪', valueOf: () => { throw 'must not convert'; } },
    { toString: () => ({}), valueOf: () => 'fallback 😀' },
]);
export default [
    [encodeURIComponent('a b'), encode('a b'), encodeURIComponent?.('雪')],
    strings.map(encode),
    coercions.map(encode),
    [encode(), encode('x', { toString: () => { throw 'ignored argument'; } })],
    [encode === read(), read() === read(), typeof encode, encode.length, String(encode)],
];
