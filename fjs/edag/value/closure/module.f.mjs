/**
 * Check closure bindings and function-body scopes in a shape-checked FJS
 * EDAG value. Analysis checks node identity across function scopes
 * and canonical lengths; its binding rules check each body's own arguments
 * and captured slots, including functions created by body expressions.
 *
 * The value shape excludes unresolved module arguments outside bodies, and
 * binding checks reject them inside bodies. Success retains the input graph.
 * Evaluated object metadata is checked separately by `../metadata/module.f.mjs`.
 * This helper serves boundaries accepting supplied EDAG data; VM constructors
 * establish these invariants directly. FJS data is acyclic by construction.
 * Diagnostics are validation failures, not program-thrown values.
 *
 * @module
 * @import { EdagValue } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { analysis, checked } from '../../analysis/module.f.mjs'
import { mapOk, okThen } from '../../../types/result/module.f.mjs'

/** Checks closure bindings and body scopes in shape-checked FJS data. @type {(value: EdagValue) => Result<EdagValue, string>} */
export const validateClosure = value => mapOk(() => value)(okThen(checked)(analysis(value)))
