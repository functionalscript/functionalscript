/**
 * Check closure bindings and function-body scopes in a shape-checked,
 * acyclic EDAG value. Analysis checks node identity across function scopes
 * and canonical lengths; its binding rules check each body's own arguments
 * and captured slots, including functions created by body expressions.
 *
 * The value shape excludes unresolved module arguments outside bodies, and
 * binding checks reject them inside bodies. Success retains the input graph.
 * Evaluated object metadata is checked separately by `../metadata/module.f.mjs`.
 * Acyclicity and admission from unknown input remain in `../../todo/edag-value.md`.
 * Diagnostics are validation failures, not program-thrown values.
 *
 * @module
 * @import { EdagValue } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { analysis, bindingError } from '../../analysis/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'

/** Checks closure bindings and body scopes; requires shape-checked, acyclic input. @type {(value: EdagValue) => Result<EdagValue, string>} */
export const validateClosure = value => {
    const r = analysis(value)
    const [kind, table] = r
    if (kind === 'error') { return r }
    const problem = bindingError(table)
    return problem === null ? ok(value) : error(problem)
}
