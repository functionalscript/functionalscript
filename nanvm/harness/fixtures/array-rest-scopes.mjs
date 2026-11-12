// Pattern names count as one parameter and captures retain each tail's value.
/** @type {(source: readonly number[]) => readonly unknown[]} */
const parameter = ([head = 9, ...tail]) => [parameter.length, head, tail];
/** @type {(source: readonly number[]) => () => readonly number[]} */
const capture = ([, ...tail]) => () => tail;
const closed = capture([1, 2, 3]);
const emptySource = [4];
const firstEmpty = capture(emptySource);
const secondEmpty = capture(emptySource);
const mutable = () => {
    let [head, ...tail] = /** @type {readonly number[]} */ ([1, 2, 3]);
    const previousTail = tail;
    head += 4;
    tail = [head, ...tail];
    return [head, tail, previousTail, tail !== previousTail];
};
/** @type {readonly (() => readonly unknown[])[]} */
let readers = [];
for (const [head, ...tail] of [[1, 2, 3], [4], []]) {
    readers = [...readers, () => [head, tail]];
}
let total = 0;
for (let [head = 0, ...tail] of [[1, 2], [3, 4, 5], []]) {
    head += tail.length;
    total += head;
}
export default [
    parameter([1, 2, 3]), parameter([]),
    [closed(), firstEmpty(), secondEmpty(), closed() === closed(), firstEmpty() !== secondEmpty()],
    mutable(), readers.map(read => read()), total,
];
