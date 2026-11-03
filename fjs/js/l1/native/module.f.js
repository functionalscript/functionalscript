/**
 * The native rows of L1 that the bodies in [`..`](../module.f.js) call so
 * far, each with a plain JavaScript body
 * ([`l1-design.md`](../../../../doc/sasha-gil/wasm/l1-design.md#the-operations)).
 * A native row has no FunctionalScript body over the L0 view: the L0 view
 * cannot read a bigint's words, for example. Every runtime implements the
 * rows, and the WASM backend will lower each function here to its
 * `fjs:l1-native` import, as it lowers [`../../l0`](../../l0/module.f.js).
 * On a JavaScript host the bodies run as they are, so the L1 bodies are
 * proved before any WASM exists.
 *
 * A row joins with its first caller. Like the L0 view, a body checks its
 * preconditions and throws where WASM would trap.
 *
 * @module
 */

import { asBigInt } from '../../l0/module.f.js'

/**
 * Whether two bigints are equal, the bigint case of `===`.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const bigintEquals = (a, b) => asBigInt(a) === asBigInt(b)
