/**
 * Expand the currently admitted source representation into normalized FAST.
 * References become immutable binding identities; immediate parameterless
 * bodies become value blocks without adding an invocation boundary.
 * Source name, declaration and capture admission remains before this pass.
 *
 * @module
 *
 * @import { AstBody, AstConst, AstFunction, AstModule } from '../../../compiler/ast/types.ts'
 * @import { BindingId, Block, Function as FastFunction, Operator, Statement, Value } from '../types.ts'
 * @import { Module } from './types.ts'
 * @import { Results, Scope, Work } from './private.ts'
 */

import { anchors, commaOperands, isInlinedCall, readCaptures } from '../../../compiler/ast/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.js'
import { mapOperator, operatorOperands } from '../module.f.mjs'

/** @type {(index: number) => BindingId} */
const binding = index => ({ index })

/** @type {(id: BindingId) => Value} */
const reference = id => ['ref', id]

/** An ordinary function keeps its own invocation and captures. @type {(scope: Scope, ast: AstFunction) => FastFunction} */
const fn = (scope, ast) => {
    const parameters = Array.from({ length: ast[1] }, (_, i) => binding(i))
    const rest = binding(parameters.length)
    const self = binding(parameters.length + 1)
    const used = readCaptures(ast)
    const sourceCaptures = ast[3] ?? []
    const captureIds = sourceCaptures.map((_, i) => binding(parameters.length + 2 + i))
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    const body = normalizedBody(ast[2], {
        imports: [], consts: [], parameters: parameters.map(reference), rest: reference(rest), self: reference(self),
        frame: captureIds.map((id, i) => used.includes(i) ? reference(id) : undefined),
    }, [])
    const captures = captureIds.flatMap((id, i) => used.includes(i)
        ? [{ binding: id, value: normalizedValue(scope)(sourceCaptures[i]) }] : [])
    return { target, parameters, rest, self, captures, body: {
        ...body,
        exit: ['return', target, body.exit[1][0]],
    } }
}

/** The leaf forms that establish their own value or region. @type {(scope: Scope, ast: AstConst) => { readonly value: Value } | null} */
const leaf = (scope, ast) => {
    if (ast === null || typeof ast !== 'object') { return { value: ast } }
    switch (ast[0]) {
        case 'aref': { return { value: scope.imports[ast[1]] } }
        case 'cref': { return { value: scope.consts[ast[1]] } }
        case 'arg': { return { value: scope.parameters[ast[1]] } }
        case 'rest': { return { value: scope.rest } }
        case 'self': { return { value: scope.self } }
        case 'fref': { return { value: scope.frame[ast[1]] } }
        case '=>': { return { value: ['function', fn(scope, ast)] } }
        case 'throw': { return { value: ['block', { statements: [], exit: ['throw', normalizedValue(scope)(ast[1])] }] } }
        case '()': {
            if (!isInlinedCall(ast)) { return null }
            const callee = /** @type {AstFunction} */ (ast[1])
            return { value: ['block', normalizedBody(callee[2], {
                imports: [], consts: [], parameters: [], rest: undefined, self: undefined,
                frame: (callee[3] ?? []).map(normalizedValue(scope)),
            }, [])] }
        }
        default: { return null }
    }
}

/**
 * An explicit stack preserves the front end's unbounded operator chains.
 * The source tree has separate occurrences; references alone share values.
 *
 * @type {(scope: Scope) => (root: AstConst) => Value}
 */
const normalizedValue = scope => root => {
    /** @type {Work} */
    let work = { kind: 'expand', value: root, rest: null }
    /** @type {Results} */
    let results = null
    while (work !== null) {
        if (work.kind === 'expand') {
            const found = leaf(scope, work.value)
            if (found !== null) {
                results = { value: found.value, rest: results }
                work = work.rest
                continue
            }
            const operator = /** @type {Operator<AstConst>} */ (work.value)
            const source = operator[0] === ',' ? /** @type {Operator<AstConst>} */ ([',', commaOperands(operator)]) : operator
            const operands = operatorOperands(source)
            work = operands.reduceRight((rest, value) => ({ kind: 'expand', value, rest }), /** @type {Work} */ ({ kind: 'operator', value: source, operands, rest: work.rest }))
            continue
        }
        /** @type {readonly Value[]} */
        let values = []
        let remaining = results
        for (const _ of work.operands) {
            const result = assertNotNullish(remaining, 'missing normalized operand')
            values = [result.value, ...values]
            remaining = result.rest
        }
        const mapped = mapOperator((_, index) => values[index])(work.value)
        results = { value: mapped, rest: remaining }
        work = work.rest
    }
    return assertNotNullish(results, 'missing normalized value').value
}

/** @type {(body: AstBody, scope: Scope, requiredImports: readonly number[]) => Block & { readonly exit: readonly ['yield', readonly Value[]] }} */
const normalizedBody = (body, scope, requiredImports) => {
    let inner = scope
    /** @type {readonly Statement[]} */
    let statements = requiredImports.map(i => /** @type {Statement} */ (['define', binding(body.length + i), scope.imports[i], 'required']))
    for (const [i, ast] of body.slice(0, -1).entries()) {
        const value = normalizedValue(inner)(ast)
        const alias = ast instanceof Array && ['cref', 'aref', 'fref', 'arg', 'rest', 'self'].includes(ast[0])
        if (alias) {
            inner = { ...inner, consts: [...inner.consts, value] }
        } else {
            const id = binding(i)
            inner = { ...inner, consts: [...inner.consts, reference(id)] }
            statements = [...statements, ['define', id, value, 'required']]
        }
    }
    return { statements, exit: ['yield', [normalizedValue(inner)(body[body.length - 1])]] }
}

/**
 * The admitted module over the import identities supplied by its boundary.
 * Linking supplies selected export nodes; unresolved compilation supplies the
 * corresponding import reads. Equal imports retain one established identity.
 *
 * @type {(module: AstModule, imports: readonly unknown[]) => Module}
 */
export const normalize = (module, imports) => {
    const parameters = module[0].map((_, i) => binding(i))
    const body = normalizedBody(module[1], {
        imports: parameters.map(reference), consts: [], parameters: [], rest: undefined, self: undefined, frame: [],
    }, anchors(module)(imports).imports)
    return { parameters, body }
}
