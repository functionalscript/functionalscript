/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the same `switch`, its `default` last
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(n: number) => string} */
const name = n => {
    switch (n) {
        case 1: { return "one"; }
        default: { return "many"; }
    }
};
export default name(1);
