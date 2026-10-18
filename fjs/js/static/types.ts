/**
 * Type-level API for `fjs/js/static/module.f.js`.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { natives, statics } from './module.f.js'

/** An admitted static path, as a tuple of keys. */
export type StaticPath = (typeof statics)[number]

/** An admitted static path every executor binds natively, with no body. */
export type NativePath = (typeof natives)[number]

/** Every native path is admitted. */
type _NativeAdmitted = Assert<Equal<NativePath extends StaticPath ? true : false, true>>
