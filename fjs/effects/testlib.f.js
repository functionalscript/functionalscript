/**
 * Assertions shared by the proofs of the effect runners and of the modules
 * built on them: the core's, the Node host's, the virtual filesystem's and
 * the content-addressed store's.
 *
 * @module
 *
 * @import { IoChannel } from './types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.js'

/**
 * Asserts that a channel error is a host failure carrying `message`. Every
 * runner reports through the same normalized `IoError`, so a proof names the
 * message rather than the shape.
 *
 * @type {(e: IoChannel, message: string) => void}
 */
export const assertIoMessage = (e, message) => {
    assert(e[0] === 'ioError', e)
    return assertEq(e[1].message, message)
}
