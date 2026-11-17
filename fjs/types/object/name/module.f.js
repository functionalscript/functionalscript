/**
 * The `name` of a value that has one. A function has a `name` too, so the
 * language does not read the property by its name
 * ([spec: entry](../../../../spec/property-access/entries/README.md)); it
 * is read with `entry`, here once for every module that needs it.
 *
 * @module
 */

import { entry } from '../entry/module.f.js'

/**
 * The `name` field of `named`, whatever its type, a `null` among them: what
 * `named.name` reads of a value that declares the field.
 *
 * @type {<N>(named: { readonly name: N }) => N}
 */
export const nameOf = named => /** @type {typeof named.name} */ (entry(named, 'name'))
