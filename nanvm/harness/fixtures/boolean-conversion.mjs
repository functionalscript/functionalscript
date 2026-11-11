/**
 * Boolean conversion through the shared runtime: every falsy primitive,
 * truthy primitives, containers and functions. The corpus compares Node's
 * default export with represented execution and generated Rust.
 */
const values = /** @type {const} */ ([
    undefined, null, false, 0, -0, NaN, 0n, "",
    true, 1, -1, Infinity, -Infinity, 1n, "0", "false", [], {}, () => 0,
]);

export default [Boolean(), values.map(value => Boolean(value))];
