/**
 * Type-level API for `fjs/js/static/module.f.js`.
 *
 * @module
 */

import type { statics } from './module.f.js'

/** An admitted static path, as a tuple of keys. */
export type StaticPath = (typeof statics)[number]
