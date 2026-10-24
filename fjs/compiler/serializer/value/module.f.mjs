/**
 * Emit evaluated values through the same normalized/prepared FAST path as
 * source and function text. Captures are established once, including unused
 * and repeated values; shared lazy nodes keep invocation-local memo storage.
 *
 * @module
 * @import { EdagValue } from '../../../edag/value/types.ts'
 */

import { assertOk } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { prepare } from '../../../js/ast/prepare/module.f.mjs'
import { stringify as serialize } from '../../../js/ast/serializer/module.f.mjs'

/** A closed value as an executable JavaScript default-export module. @type {(value: EdagValue) => string} */
export const stringify = value => serialize(prepare(fromAnalysis(assertOk(identityAnalysis(value)))), 'module', true)

/** A default factory constructs a fresh value on each call. @type {(value: EdagValue) => string} */
export const factoryStringify = value => serialize(prepare(fromAnalysis(assertOk(identityAnalysis(value)))), 'factory', true)
