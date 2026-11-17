/**
 * The `name` of a value that has one. A function has a `name` too, so the
 * language does not read the property by its name
 * ([spec: entry](../../../../spec/property-access/entries/README.md)); it
 * is read with `entry`, here once for every module that needs it.
 *
 * @module
 */

import { assertNotNullish } from '../../../asserts/module.f.js'
import { entry } from '../entry/module.f.js'

/**
 * The `name` field of `named`, as the type it was given.
 *
 * @type {<N extends string>(named: { readonly name: N }) => N}
 */
export const nameOf = named => assertNotNullish(entry(named, 'name'))
