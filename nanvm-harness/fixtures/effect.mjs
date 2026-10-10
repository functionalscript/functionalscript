/**
 * Compiled by `fjs compile` into `../gen.fixtures/effect.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../tests/effects.rs`, which runs these through the loop of
 * `nanvm-effects-node`: programs that *return* effects, as `fjs/effects`
 * builds them, and never perform one.
 *
 * An effect is a `Pure`, a function answering a `Result`, or a `Do`, an object
 * holding the `command` to perform, its `payload` and the `continuation` that
 * takes the answer to the next effect.
 */

/**
 * A `Pure` ending with `['ok', the answer it was given]`.
 *
 * @type {(answer: unknown) => () => readonly ['ok', unknown]}
 */
const done = answer => () => ['ok', answer];

/** Two commands, the second reached through the first's continuation. */
export const chain = {
    command: 'echo',
    payload: ['first'],
    /** @type {(answer: unknown) => unknown} */
    continuation: answer => ({ command: 'echo', payload: [answer, 'second'], continuation: done }),
};

/** A continuation that throws in the language: `1n / 0n`. */
export const thrown = {
    command: 'echo',
    payload: [],
    /** @type {(answer: unknown) => unknown} */
    continuation: answer => 1n / 0n,
};

/** `write('stdout', 'bye')`, then the answer to it. */
const bye = { command: 'write', payload: ['stdout', -14_842_213n], continuation: done };

/** `write('stdout', 'hi')`, then `bye`: the continuation ignores the answer. */
export const hello = {
    command: 'write',
    payload: ['stdout', -59_497n],
    /** @type {(answer: unknown) => typeof bye} */
    continuation: answer => bye,
};

/** A command no host here has: answered `notImplemented` through the continuation. */
export const missing = { command: 'fetch', payload: ['http://example.com'], continuation: done };
