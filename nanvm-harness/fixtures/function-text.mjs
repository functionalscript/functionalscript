/**
 * Compiled by `fjs compile` into `../gen.fixtures/function_text.rs`, committed
 * and drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed
 * by `../src/lib.rs`. Pins a function's text, the FunctionalScript writer's
 * spelling (`nanvm-lib/todo/to-primitive.md`, Stage 3): through `toString`,
 * `+`, an array joined, a returned function whose capture is named by its
 * slot, a nested function, and an exported function, which the test reads
 * as a value and converts.
 */
/** @type {(...a: readonly number[]) => (...b: readonly number[]) => number} */
const add = (...a) => (...b) => a[0] + b[0];
const one = () => 1;
export const inc = add(1);
export default [
    one.toString(),
    one + "!",
    [one, 2].join("|"),
    add(1).toString(),
    add.toString(),
];
