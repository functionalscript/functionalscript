/**
 * The RTTI schemas of the operations a native effect runner implements: the
 * compiler's file and console I/O, plus `read` for console input. A schema is the
 * specification of record for an operation's request and result; the
 * declarations in [`../node/types.ts`](../node/types.ts) are pinned to it in
 * [`./types.ts`](./types.ts), and a generated trait for `nanvm-effects-node`
 * follows it ([`todo/nanvm-effects-node.md`](../../../todo/nanvm-effects-node.md)).
 *
 * An operation is its tag, the schema of its parameters, a closed tuple whose
 * trailing optional parameters are `or(option, t, undefined)`, admitting both
 * omission and an explicitly passed `undefined`, and the schema of the
 * value its `Result` carries on success. The `Result` and its error channel,
 * which every operation shares, are written once, {@link result},
 * {@link ioResult} and {@link opResult}.
 *
 * Only data-shaped operations are here. An operation that takes a callback
 * (`sandbox`, `catch`), effects (`all`), or arbitrary values (`memCreate`)
 * is handwritten on each side, as the todo's audit records.
 *
 * @module
 *
 * @import { Phantom } from '../../types/phantom/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Type } from '../../rtti/types.ts'
 */

import { array, bigint, boolean, number, option, or, string } from '../../rtti/module.f.mjs'

/**
 * A bit vector, the bytes of a file. At run time it is a `bigint`; the brand
 * is the one thing the schema cannot check, so `Ts<vec>` is `Vec` on trust,
 * and the `bigint` underneath is what a validator tests.
 *
 * @type {Phantom<typeof bigint, Vec>}
 */
export const vec = bigint

/**
 * The success value of an operation with nothing to return: `undefined` at
 * run time, `void` where it is declared.
 *
 * @type {Phantom<() => readonly ['or', undefined], void>}
 */
export const nothing = or(undefined)

/** The runner's report that it does not implement an operation. */
export const notImplemented = /** @type {const} */ (['notImplemented', string])

/** A normalized host failure: an optional code and a message. */
export const ioError = /** @type {const} */ (['ioError', { code: or(option, string), message: string }])

/** The error channel of anything that performs host IO. */
export const ioChannel = or(notImplemented, ioError)

/**
 * A `Result` of success type `t` and failure type `e`.
 *
 * @template {Type} T
 * @template {Type} E
 * @param {T} t
 * @param {E} e
 */
export const result = (t, e) => or(['ok', t], ['error', e])

/**
 * The result of an operation that performs host IO.
 *
 * @template {Type} T
 * @param {T} t
 */
export const ioResult = t => result(t, ioChannel)

/**
 * The result of an operation with no failures of its own.
 *
 * @template {Type} T
 * @param {T} t
 */
export const opResult = t => result(t, notImplemented)

/**
 * An operation: its tag, the schema of its parameters and the schema of the
 * `Result` it answers.
 *
 * @template {string} N
 * @template {readonly Type[]} const P
 * @template {Type} R
 * @param {N} name
 * @param {P} params
 * @param {R} answer
 */
const operation = (name, params, answer) => /** @type {const} */ ({ name, params, answer })

// Structs

/** The options of `mkdir`. */
export const makeDirectoryOptions = /** @type {const} */ ({ recursive: true })

/** A module `resolveFileModule` found. */
export const fileModule = /** @type {const} */ ({ id: string, path: string })

/** The options of `readdir`. */
export const readdirOptions = /** @type {const} */ ({ recursive: or(option, true) })

/** An entry of a directory. */
export const dirent = /** @type {const} */ ({
    name: string,
    parentPath: string,
    isFile: boolean,
    isDirectory: boolean,
})

// Operations

export const mkdir = operation(
    'mkdir', [string, or(option, makeDirectoryOptions, undefined)], ioResult(nothing))

export const readFile = operation('readFile', [string], ioResult(vec))

export const resolveFileModule = operation(
    'resolveFileModule', [string, or(string, null)], ioResult(fileModule))

export const readdir = operation(
    'readdir', [string, readdirOptions], ioResult(array(dirent)))

export const writeFile = operation('writeFile', [string, vec], ioResult(nothing))

export const writeBytes = operation(
    'writeBytes', [string, number, vec], ioResult(nothing))

export const rm = operation('rm', [string], ioResult(nothing))

export const write = operation(
    'write', [or('stdout', 'stderr'), vec], opResult(nothing))

export const read = operation('read', ['stdin'], opResult(or(number, null)))

/** Every operation the first generated trait covers, by tag. */
export const operations = /** @type {const} */ ({ mkdir, readFile, resolveFileModule, readdir, writeFile, writeBytes, rm, write, read })
