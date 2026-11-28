// A capture keeps the copy it was made with. Whether two calls' copies of
// equal content are one object is the executor's to choose
// (`spec/todo/value-identity.md`), so it is not compared here.
/** @type {(source: { drop: number, kept?: readonly number[] }) => () => object} */
const capture = ({ drop, ...rest }) => () => rest;
const shared = /** @type {const} */ ([3]);
const changed = /** @type {const} */ ([5]);
const first = capture({ drop: 1, kept: shared });
const second = capture({ drop: 1, kept: shared });
const firstEmpty = capture({ drop: 1 });
const secondEmpty = capture({ drop: 1 });
const snapshot = () => {
    /** @type {{ a?: unknown, b: number | undefined, kept: readonly number[], added?: number }} */
    let source = { a: undefined, b: undefined, kept: shared };
    const replacement = { b: 44, kept: changed, added: 9 };
    const { a = (() => { source = replacement; return source; })(), b = 13, ...rest } = source;
    return [a === replacement, b, rest.kept === shared, Object.entries(rest), source === replacement];
};
const pair = () => {
    const item = { value: 29 };
    return { chosen: item, kept: item };
};
const { chosen, ...pairedRest } = pair();
/** @type {readonly (() => unknown)[]} */
let readers = [];
// Capture both bindings per iteration; the copied object must exclude drop.
for (const { drop, ...rest } of [{ drop: 1, kept: shared }, { drop: 2, kept: changed }]) {
    readers = [...readers, () => [drop, rest]];
}
export default [
    [capture.length, first() === first(), second(),
        firstEmpty() === firstEmpty(), secondEmpty(), firstEmpty()],
    snapshot(), chosen === pairedRest.kept, readers.map(read => read()),
];
