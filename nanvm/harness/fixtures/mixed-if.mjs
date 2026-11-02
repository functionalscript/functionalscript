// Partly returning ordinary branches preserve their function owner and join
// only the paths reaching the explicit following return.

/** @type {(condition: boolean, stop: boolean) => number} */
export const partial = (condition, stop) => {
    if (condition) {
        const packet = /** @type {const} */ ([stop, 7]);
        if (packet[0]) { return packet[1]; }
    }
    return 9;
};

/** @type {(condition: boolean, stop: boolean) => number} */
export const parameterized = (condition, stop) => {
    let z = 0;
    if (condition) {
        const x = /** @type {const} */ ({ a: () => stop, b: () => 7, c: () => 3 });
        if (x.a()) { return x.b(); }
        z += x.c();
    }
    return z + 5;
};

/** @type {(condition: boolean, stop: boolean) => readonly any[]} */
export const nested = (condition, stop) => {
    /** @type {number | readonly number[]} */
    let m = 5;
    if (condition) {
        const x = /** @type {const} */ ({ a: [7], b: stop, c: [99] });
        m = x.a;
        if (x.b) { return x.c; }
    }
    return [m, m];
};

/** @type {(condition: boolean) => readonly any[]} */
export const snapshotObservation = condition => {
    const one = nested(condition, false);
    const two = nested(condition, false);
    return [one[0] === one[1], one !== two, condition ? one[0] !== two[0] : true, one[0]];
};

/** @type {(condition: boolean) => number} */
export const localOwner = condition => {
    let a = 0;
    if (condition) {
        const local = () => {
            if (condition) { return 7; }
            return 8;
        };
        a = local();
    }
    return a + 1;
};

/** @type {(valid: boolean) => number} */
export const requiredRead = valid => {
    let m = 0;
    if (true) {
        // A null is intentional failing data: the required read cannot vanish
        // just because this branch then returns a constant from its owner.
        const x = /** @type {{readonly a: number}} */ (/** @type {unknown} */ (valid ? { a: 7 } : null));
        m = x.a;
        if (true) { return 1; }
    }
    return m;
};

/** @type {(n: number, a: number) => number} */
export const tail = (n, a) => {
    let next = a;
    if (n > 0) {
        const packet = /** @type {const} */ ([n - 1, a + 1]);
        if (n === 1) { return packet[1]; }
        next = packet[1];
    } else {
        return a;
    }
    return tail(n - 1, next);
};

export default [
    partial(false, false), partial(true, false), partial(true, true),
    parameterized(false, false), parameterized(true, false), parameterized(true, true),
    snapshotObservation(false), snapshotObservation(true), nested(true, true),
    localOwner(false), localOwner(true), requiredRead(true), tail(3, 7),
];
