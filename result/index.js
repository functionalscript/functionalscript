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
const ok = value => ['ok', value]

/** @type {<E>(e: E) => Error<E>} */
const error = e => ['error', e]

module.exports = {
    /** @readonly */
    ok,
    /** @readonly */
    error,
}
