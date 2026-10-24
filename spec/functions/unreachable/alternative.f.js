/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the same function, without the statement that never runs
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {() => number} */
const f = () => {
    return 1;
};
export default f();
