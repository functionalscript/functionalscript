/**
 * Compiled by `fjs compile` into `../gen.fixtures/effect.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../tests/effects.rs`, which runs these on the native runner
 * (`nanvm-effects-node`): programs that *return* effects, as `fjs/effects`
 * builds them, and never perform one.
 *
 * An effect is a `Pure`, a function answering a `Result`, or a `Do`, an
 * object holding the `command` to perform, its `payload` and the
 * `continuation` that takes the answer to the next effect. The two bit vectors
 * are `"hi"` and `"bye"` as the language spells bytes: the bits with a stop bit
 * in front, negated where the first bit was `0`.
 */

/**
 * A `Pure` ending with `['ok', the answer it was given]`.
 *
 * @type {(...answer: readonly unknown[]) => () => readonly ['ok', unknown]}
 */
const done = (...answer) => () => ['ok', answer[0]];

/** `write('stdout', 'bye')`, then the answer to it. */
const bye = { command: 'write', payload: ['stdout', -14842213n], continuation: done };

/** `write('stdout', 'hi')`, then `bye`: the continuation ignores the answer. */
export const hello = {
    command: 'write',
    payload: ['stdout', -59497n],
    /** @type {(...answer: readonly unknown[]) => typeof bye} */
    continuation: (...answer) => bye,
};

/** A command no runner here has, answered `NotImplemented` through the continuation. */
export const missing = { command: 'fetch', payload: ['http://example.com'], continuation: done };

/** `catch` of a thunk that throws: the answer holds what it threw. */
export const caught = { command: 'catch', payload: [() => 1n / 0n], continuation: done };
