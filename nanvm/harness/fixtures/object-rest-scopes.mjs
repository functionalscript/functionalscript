// Captures keep their own copy, including empty copies from separate calls.
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
for (const { drop, ...rest } of [{ drop: 1, kept: shared }, { drop: 2, kept: changed }]) {
    readers = [...readers, () => rest.kept];
}
export default [
    [capture.length, first() === first(), first() !== second(),
        firstEmpty() === firstEmpty(), firstEmpty() !== secondEmpty(), firstEmpty()],
    snapshot(), chosen === pairedRest.kept, readers.map(read => read()),
];
