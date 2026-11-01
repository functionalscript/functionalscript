// Compiler inputs for owning self tail calls inside source loops. The default
// stays shallow for Node/reference parity; the Rust tests call the named
// exports deeply enough to require bounded-stack execution.

/** @type {(n: number) => number} */
export const terminal = n => {
    while (true) {
        if (n === 0) { return 0; }
        return terminal(n - 1);
    }
};

/** @type {(n: number, total: number) => number} */
export const terminalLocals = (n, total) => {
    let step = 0;
    while (true) {
        step = step + 1;
        if (step < 2) { continue; }
        if (n === 0) { return total + step; }
        return terminalLocals(n - 1, total + step);
    }
};

/** @type {(n: number, total: number) => number} */
export const ordinaryLocals = (n, total) => {
    let step = 0;
    while (step < 2) {
        step = step + 1;
        if (n === 0) { return total + step; }
        if (step === 2) { return ordinaryLocals(n - 1, total + step); }
    }
    return total;
};

/** @type {(n: number, left: number, right: number) => readonly number[]} */
export const swapped = (n, left, right) => {
    while (true) {
        if (n === 0) { return [left, right]; }
        return swapped(n - 1, right, left);
    }
};

export default [terminal(3), terminalLocals(3, 0), ordinaryLocals(3, 0), swapped(3, 1, 2)];
