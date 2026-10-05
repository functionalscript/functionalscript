/**
 * Deferred inputs for evaluated EDAG object construction.
 *
 * @module
 */

import type { EdagValue, Property } from '../types.ts'
import type { ValueThunk } from '../control/types.ts'
import type { Result } from '../../../types/result/types.ts'

/** Evaluate a property, resolving its key to a string before its value. */
export type PropertyThunk = () => Result<Property, EdagValue>

/** Ordinary properties and spread operands, in evaluation order. */
export type ObjectItems = readonly (PropertyThunk | readonly ['...', ValueThunk])[]
