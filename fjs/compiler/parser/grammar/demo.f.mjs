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
 * `fjs/ebnf/token_symbol`, so a pill is a token's name: `=>`, `import`.
 * Names that stand for any token of their kind rather than their own text —
 * `id`, `string`, `number`, `bigint` and the four template chunks — are
 * drawn as grey pills in italics. Whitespace and comments are no tokens, so
 * no diagram mentions them.
 *
 * **The diagrams are the exported rules, by their export names**, and so
 * are the operator layers of `eagerTail`, one diagram per layer, from
 * `mul_div_mod` to `or`: each layer's operand is `unary` followed by every
 * layer tighter than it, which is the precedence ladder drawn as boxes.
 * Every rule that reaches itself — a value holds values, a list is
 * right-recursive — is titled, so no diagram is drawn forever.
 * `callArguments` draws the same list as `values`: the grammar reads a
 * call's arguments through a rule of its own, which the parser maps apart
 * from an array's items.
 *
 * @module
 *
 * @import { Selection } from '../../../website/demo/railroad/types.ts'
 */

import {
    _ordinaryTokenNames, access, afterValue, array, arrowOrRest, attribute, bindingTarget, block, body, callArguments,
    circuitTail, conditionalTail, constStatement, djsModule, eagerTail, end, entries, entry, func, group, groupOperand,
    identifier, identifierName, importBinding, importBindings, importClause, importStatement, item,
    lastStatement, member, namedImports, object, optionalStep, parameterNames, parameters, paren, parenItems,
    parenGroup, parenGroupOperand, parenthesized, primitive, statement, afterCase, caseTail, template, terminator, unary, unaryOperand,
    value, values,
} from './module.f.mjs'
import { eagerLayers } from '../../ast/module.f.mjs'
import { encoding } from '../../../ebnf/token_symbol/module.f.mjs'
import { tokens } from '../../../ebnf/railroad/module.f.mjs'
import { grammarDemo } from '../../../website/demo/railroad/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.js'

/**
 * One diagram per `eagerTail` layer, titled by the names of its operators
 * in `eagerLayers` — `mul_div_mod`, `add_sub`, … `or` — so a title is read
 * from the table the layer is built from and moves with it. A title is an
 * anchor a box links to, so it is the operators' names, not their tokens.
 *
 * @type {readonly Selection[]}
 */
const layers = eagerTail.map((rule, i) => [Object.keys(assertNotNullish(eagerLayers[i])).join('_'), rule])

/**
 * Each diagram's title and the rule it draws, in the order the page
 * shows them: the module first, then its statements, then a value from the
 * outside in, and the words and lists everything reaches last.
 *
 * @type {readonly Selection[]}
 */
export const diagrams = [
    ['djsModule', djsModule],
    ['importStatement', importStatement],
    ['importClause', importClause],
    ['namedImports', namedImports],
    ['importBindings', importBindings],
    ['importBinding', importBinding],
    ['attribute', attribute],
    ['constStatement', constStatement],
    ['bindingTarget', bindingTarget],
    ['lastStatement', lastStatement],
    ['end', end],
    ['value', value],
    ['body', body],
    ['block', block],
    ['statement', statement],
    ['terminator', terminator],
    ['caseTail', caseTail],
    ['afterCase', afterCase],
    ['paren', paren],
    ['parenthesized', parenthesized],
    ['func', func],
    ['parameters', parameters],
    ['afterValue', afterValue],
    ['parenItems', parenItems],
    ['parameterNames', parameterNames],
    ['arrowOrRest', arrowOrRest],
    ['unary', unary],
    ['unaryOperand', unaryOperand],
    ['parenGroup', parenGroup],
    ['group', group],
    ['parenGroupOperand', parenGroupOperand],
    ['groupOperand', groupOperand],
    ...layers,
    ['circuitTail', circuitTail],
    ['conditionalTail', conditionalTail],
    ['access', access],
    ['optionalStep', optionalStep],
    ['callArguments', callArguments],
    ['template', template],
    ['array', array],
    ['values', values],
    ['item', item],
    ['object', object],
    ['entries', entries],
    ['entry', entry],
    ['member', member],
    ['primitive', primitive],
    ['identifier', identifier],
    ['identifierName', identifierName],
]

/** The token kinds that stand for any token of their kind, not for their own text. */
const categories = /** @type {const} */ ([
    'id', 'string', 'number', 'bigint',
    'noSubstitutionTemplate', 'templateHead', 'templateMiddle', 'templateTail',
])

export const demo = grammarDemo({
    grammar: djsModule,
    alphabet: tokens(encoding(_ordinaryTokenNames), categories),
    description: 'The FunctionalScript module grammar, drawn from the rules the parser reads a module with.',
    guide: 'Follow a track from left to right; a pill is a token, a grey one in italics any token of its kind, and a box is another diagram — select it to go there.',
    selections: diagrams,
})
