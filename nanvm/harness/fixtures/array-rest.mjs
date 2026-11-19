// Array rest slices the materialized iterable, preserving element identity.
const shared = { value: 17 };
const member = () => 17;
const source = [shared, member, undefined];
const [...copy] = source;
const [...secondCopy] = source;
const [, ...functionTail] = source;
const [outer, [inner, ...innerTail], ...outerTail] = /** @type {const} */ ([1, [2, 3, 4], 5, 6]);
const [, ...[restFirst, ...restTail]] = [0, 7, 8, 9];
const [, ...{ length: restLength }] = [0, 10, 11, 12];
const [...[emptyDefault = 13, ...emptyTail]] = /** @type {readonly number[]} */ ([]);
const [base = 4, next = base + 1, , ...defaultTail] = [undefined, undefined, 8, 9, 10];
const fail = () => { throw 'must not use array default'; };
const [kept = fail(), ...keptTail] = [null, 2];
const [lead, ...unicodeTail] = '😀a𝄞\ud800b\udc00';
const [, ...loneTail] = '\ud800x\udc00';
const [, , ...afterTwo] = '😀ab';
const makePair = () => {
    const item = { value: 23 };
    return [item, item];
};
const [pairHead, ...pairTail] = makePair();
export default [
    [copy !== source, copy !== secondCopy, copy[0] === shared, copy[1] === member,
        functionTail[0] === member, functionTail[1] === undefined, pairHead === pairTail[0]],
    [outer, inner, innerTail, outerTail],
    [restFirst, restTail, restLength, emptyDefault, emptyTail],
    [base, next, defaultTail, kept, keptTail],
    [lead, unicodeTail, loneTail, afterTwo],
];
