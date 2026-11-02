// Ordinary normally completing conditionals use the same immutable joins as
// loop branches. Explicit final returns remain part of the source contract.

/** @type {(condition: boolean) => number} */
export const normal = condition => {
    let a = 0;
    if (condition) { a += 2; }
    return a * 10;
};

/** @type {(condition: boolean) => number} */
export const alternate = condition => {
    let a = 0;
    if (condition) { a += 2; } else { a += 5; }
    return a * 10;
};

/** @type {(condition: boolean, left: readonly number[], right: readonly number[]) => readonly any[]} */
const snapshot = (condition, left, right) => {
    /** @type {readonly any[]} */
    let packet = left;
    if (condition) {
        const selected = right;
        packet = [selected, () => selected];
    } else {
        const selected = left;
        packet = [selected, () => selected];
    }
    const held = packet;
    return [held, held, () => held];
};

/** @type {(condition: boolean) => readonly (boolean | number)[]} */
export const snapshotObservation = condition => {
    const one = snapshot(condition, [3], [7]);
    const two = snapshot(condition, [3], [7]);
    return [
        one[0] === one[1],
        one[2]() === one[0],
        one[0][1]() === one[0][0],
        one[0] !== two[0],
        one[0][0][0],
    ];
};

/** @type {(condition: boolean) => number} */
export const selectedFailure = condition => {
    let a = 0;
    if (condition) {
        const required = 1n / 0n;
        a = 1;
    }
    return a;
};

/** @type {(n: number, a: number) => number} */
export const tail = (n, a) => {
    if (n === 0) { return a; }
    let next = a;
    if (n > 0) { next += 1; }
    return tail(n - 1, next);
};

export default [
    normal(true), normal(false), alternate(true), alternate(false),
    snapshotObservation(true), snapshotObservation(false), selectedFailure(false),
    tail(3, 7),
];
