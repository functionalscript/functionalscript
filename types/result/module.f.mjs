// @ts-self-types="./module.f.d.mts"
/**
 * @template T
 * @typedef {readonly['ok', T]} Ok
 */

/**
 * @template E
 * @typedef {readonly['error', E]} Error
 */

/**
 * @template T
 * @template E
 * @typedef {Ok<T>|Error<E>} Result
 */

/** @type {<T>(value: T) => Ok<T>} */
export const ok = value => ['ok', value]

/** @type {<E>(e: E) => Error<E>} */
export const error = e => ['error', e]

/** @type {<T, E>(r: Result<T, E>) => T} */
export const unwrap = ([kind, v]) => {
    if (kind === 'error') { throw v }
    return v
}
