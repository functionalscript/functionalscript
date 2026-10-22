/**
 * The proof of [`testlib.f.js`](./testlib.f.js): a host failure with the
 * message asked for passes, and anything else throws.
 */

import { assertIoMessage } from './testlib.f.js'

export const proof = {
    ioError: () => assertIoMessage(['ioError', { message: 'gone' }], 'gone'),
    throw: {
        notImplemented: () => assertIoMessage(['notImplemented', 'readFile'], 'gone'),
        otherMessage: () => assertIoMessage(['ioError', { message: 'gone' }], 'here'),
    },
}
