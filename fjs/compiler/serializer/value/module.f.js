/**
 * Emit evaluated values through the same normalized/prepared FAST path as
 * source and function text. Captures are established once, including unused
 * and repeated values; shared lazy nodes keep invocation-local memo storage.
 *
 * @module
 * @import { EdagValue } from '../../../edag/value/types.ts'
 * @import { Block } from '../../../js/ast/prepare/types.ts'
 */

import { assertOk } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.js'
import { ownBodies } from '../../../edag/value/function/module.f.js'
import { fromAnalysis } from '../../../edag/to_fast/module.f.js'
import { prepare } from '../../../js/ast/prepare/module.f.js'
import { stringify as serialize } from '../../../js/ast/serializer/module.f.js'

/**
 * The value as prepared FAST. Its functions are given bodies of their own
 * first: two made from one arrow share their body code, which the analysis
 * would take for one node under two functions.
 *
 * @type {(value: EdagValue) => Block}
 */
const prepared = value => prepare(fromAnalysis(assertOk(identityAnalysis(ownBodies(value)))))

/** A closed value as an executable JavaScript default-export module. @type {(value: EdagValue) => string} */
export const stringify = value => serialize(prepared(value), 'module', true)

/** A default factory constructs a fresh value on each call. @type {(value: EdagValue) => string} */
export const factoryStringify = value => serialize(prepared(value), 'factory', true)
