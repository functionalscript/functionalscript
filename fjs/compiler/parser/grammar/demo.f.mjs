/**
 * The FunctionalScript module grammar as syntax diagrams: one diagram per
 * rule a reader looks for, each reference to another one a box that links
 * to its diagram.
 *
 * **Drawn from this grammar, not redrawn by hand.** `toData` lowers the rules
 * `./module.f.mjs` exports, `fjs/ebnf/railroad` reads the lowered set back
 * as diagrams, and `fjs/website/demo/railroad` lays them out — so a change to
 * the grammar is a change to the picture, as it is for the JSON grammar's
 * (`fjs/ebnf/lib/json/demo.f.mjs`).
 *
 * **A terminal is a token, not a character.** The grammar reads the
 * tokenizer's output, each token encoded as a symbol by
 * `fjs/ebnf/token_symbol`, so a pill is a token's name: `=>`, `import`. Four
 * names stand for any token of their kind rather than for their own text —
 * `id`, `string`, `number` and `bigint` — and are drawn in italics.
 * Whitespace and comments are no tokens, so no diagram mentions them.
 *
 * **The diagrams are the exported rules, by their export names**, and so
 * are the operator layers of `eagerTail`, one diagram per layer, from
 * `multiplicative` to `bitwiseOr`: each layer's operand is `unary` followed
 * by every layer tighter than it, which is the precedence ladder drawn as
 * boxes. Every
 * rule that reaches itself — a value holds values, a list is
 * right-recursive — is titled, so no diagram is drawn forever.
 *
 * @module
 *
 * @import { Rule } from '../../../ebnf/types.ts'
 */

import {
    _ordinaryTokenNames, access, afterValue, array, arrowOrRest, attribute, block, body, circuitTail,
    conditionalTail, constStatement, djsModule, eagerTail, end, entries, entry, func, group, groupOperand,
    identifier, identifierName, importBinding, importBindings, importClause, importStatement, item,
    lastStatement, member, namedImports, object, optionalStep, parameterNames, parameters, paren,
    parenGroup, parenGroupOperand, parenthesized, primitive, statement, terminator, unary, unaryOperand,
    value, values,
} from './module.f.mjs'
import { toData } from '../../../ebnf/data/module.f.mjs'
import { encoding } from '../../../ebnf/token_symbol/module.f.mjs'
import { tokens, toDiagrams } from '../../../ebnf/railroad/module.f.mjs'
import { railroadDemo } from '../../../website/demo/railroad/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.mjs'

const [ruleSet, entryName, names] = toData(djsModule)

/** @type {(rule: Rule) => string} */
const nameOf = rule => assertNotNullish(names.get(rule))

/**
 * The names of the `eagerTail` layers, tightest first: ECMAScript's names
 * for the expressions each layer reads, which the grammar's own comment
 * uses too. A title is an anchor a box links to, so it is a word rather
 * than the layer's operators.
 */
const layerNames = ['multiplicative', 'additive', 'shift', 'relational', 'equality', 'bitwiseAnd', 'bitwiseXor', 'bitwiseOr']

/**
 * One diagram per `eagerTail` layer, under its name. A layer added to
 * `eagerLayers` without a name here has no title, and is refused rather
 * than drawn under a missing one.
 *
 * @type {readonly (readonly [string, string])[]}
 */
const layers = eagerTail.map((rule, i) => [assertNotNullish(layerNames[i], ['an eager layer has no name', i]), nameOf(rule)])

/**
 * Each diagram's title and the lowered rule it draws, in the order the page
 * shows them: the module first, then its statements, then a value from the
 * outside in, and the words and lists everything reaches last.
 *
 * @type {readonly (readonly [string, string])[]}
 */
export const diagrams = [
    ['djsModule', entryName],
    ['importStatement', nameOf(importStatement)],
    ['importClause', nameOf(importClause)],
    ['namedImports', nameOf(namedImports)],
    ['importBindings', nameOf(importBindings)],
    ['importBinding', nameOf(importBinding)],
    ['attribute', nameOf(attribute)],
    ['constStatement', nameOf(constStatement)],
    ['lastStatement', nameOf(lastStatement)],
    ['end', nameOf(end)],
    ['value', nameOf(value)],
    ['body', nameOf(body)],
    ['block', nameOf(block)],
    ['statement', nameOf(statement)],
    ['terminator', nameOf(terminator)],
    ['paren', nameOf(paren)],
    ['parenthesized', nameOf(parenthesized)],
    ['func', nameOf(func)],
    ['parameters', nameOf(parameters)],
    ['afterValue', nameOf(afterValue)],
    ['parameterNames', nameOf(parameterNames)],
    ['arrowOrRest', nameOf(arrowOrRest)],
    ['unary', nameOf(unary)],
    ['unaryOperand', nameOf(unaryOperand)],
    ['parenGroup', nameOf(parenGroup)],
    ['group', nameOf(group)],
    ['parenGroupOperand', nameOf(parenGroupOperand)],
    ['groupOperand', nameOf(groupOperand)],
    ...layers,
    ['circuitTail', nameOf(circuitTail)],
    ['conditionalTail', nameOf(conditionalTail)],
    ['access', nameOf(access)],
    ['optionalStep', nameOf(optionalStep)],
    ['array', nameOf(array)],
    ['values', nameOf(values)],
    ['item', nameOf(item)],
    ['object', nameOf(object)],
    ['entries', nameOf(entries)],
    ['entry', nameOf(entry)],
    ['member', nameOf(member)],
    ['primitive', nameOf(primitive)],
    ['identifier', nameOf(identifier)],
    ['identifierName', nameOf(identifierName)],
]

/** The token kinds that stand for any token of their kind, not for their own text. */
const categories = /** @type {const} */ (['id', 'string', 'number', 'bigint'])

export const demo = railroadDemo('The FunctionalScript module grammar, drawn from the rules the parser reads a module with. Follow a track from left to right; a pill is a token, one in italics any token of its kind, and a box is another diagram — select it to go there.')(toDiagrams(tokens(encoding(_ordinaryTokenNames), categories))(ruleSet)(diagrams))
