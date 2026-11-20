/**
 * The parity table: the values, as source, that `proof.mjs` evaluates on
 * the host for L1 and compiles for the interpreter, and the keys a member
 * read takes. [`fjs/ir/from_fast/proof.mjs`](../../../../ir/from_fast/proof.mjs)
 * runs the lowered L1 module on the same table, so the two stay one.
 *
 * @module
 */

/** Values as source, each evaluated by the host for L1 and compiled for the interpreter. */
export const sources = [
    'undefined', 'null', 'true', 'false', '0', '-0', '1', '-1.5', '0 / 0', '1 / 0',
    "''", "'a'", "'ab'", "'1'", "'\\u{1F600}'", '0n', '1n', '-2n',
    '[]', '[1]', '[1, 2]', '{}', '{ a: 1 }', '{ valueOf: () => 2 }', '{ toString: () => "x" }',
]

/**
 * {@link sources} and a function. A function's text is the runtime's: the
 * interpreter renders its own, where a JavaScript host answers the source,
 * so a function joins only the operations that do not read its text.
 */
export const withFunction = [...sources, 'x => x']

/**
 * Keys a member read takes: numbers and strings, as the compiler emits
 * them. A computed number key is written `Number(...)`, as the compiler
 * requires.
 */
export const keySources = ['Number(0)', 'Number(1)', 'Number(-0)', 'Number(1.5)', "'0'", "'01'", "'a'", "'length'"]

/** The host value of a source. @type {(s: string) => unknown} */
export const value = s => Function(`return ${s}`)()
