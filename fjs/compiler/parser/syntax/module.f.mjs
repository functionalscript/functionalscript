/**
 * The syntax reader: the rewrite set that folds the tree of the grammar
 * in `../grammar` into a module record as the LL(1) backend builds it, and
 * {@link parseSyntax}, the reader over a token stream. What it builds is
 * the syntax tree, `./types.ts`; the fold in `../module.f.mjs` resolves
 * its names and makes the AST of it.
 *
 * ```text
 * ModuleToken stream ==the module grammar, one symbol per token==> tree
 *                 ==the rewrite set: a node per value, a record per statement==> module
 * ```
 *
 * A mapping sees one rule's node and no environment, so it builds a node
 * per value — a primitive, a reference by the token that spells it, a
 * container of nodes — and a record per statement, and the names are
 * resolved where the statements are read, after the grammar has matched
 * the whole module. Beside each value's node it keeps the binding target
 * the same text is, `BindingTarget`, built the same way, so that a `const`
 * or a parameter list reads its pattern off the literal the grammar read.
 * A mapping reports no error: what it cannot say is recorded for the fold
 * to refuse — a parameter list whose head is no target, `{ invalid }`, a
 * value where a target was wanted, `['invalid', token]`, and a statement's
 * first token and whether a `;` ended it, `Statement`.
 *
 * Every walk is a mapping of one node, and a list's mapping puts one item
 * before the list its tail's mapping returned, so nesting depth and width
 * stay the input's.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { Ast, Children, Meta } from '../../../ebnf/ast/types.ts'
 * @import { Mappings, RewriteSet } from '../../../ebnf/ll1/types.ts'
 * @import { Rule } from '../../../ebnf/types.ts'
 * @import { Primitive } from '../../../media/datajs/types.ts'
 * @import { ModuleTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { ParseError } from '../types.ts'
 * @import { BindingElement, BindingProperty, BindingTarget, Block, BlockStatement, Case, Chain, Const, Element, Elision, Entry, Import, ImportBinding, Item, Key, LoopBlock, LoopIf, LoopStatement, LoopSwitch, Member, ModuleStatement as ModuleStatementRecord, NamedStatement, Module, ModuleConst, Node, Out, Parameter, ParameterList, Parameters, Step, ValueStatement, While } from './types.ts'
 * @import { BlockContents, ArrowOrRest, BindingTarget as BindingTargetRule, Block as BlockRule, Body, ConstStatement, Elements, Entry as EntryRule, Group, Item as ItemRule, Items, LastStatement, LoopBlock as LoopBlockRule, LoopElse, LoopIfStatement, LoopStatement as LoopStatementRule, LoopSwitch as LoopSwitchRule, Member as MemberRule, ModuleStatement, BodyNameStatement, ParameterNames, ParenItems, Parenthesized, SimpleStatement, AfterCase, CaseTail, Template, Terminator, Unary, UnaryOperand, Value, WhileStatement } from '../grammar/types.ts'
 * @import { namedImports, primitive } from '../grammar/module.f.mjs'
 * @import { _AccessNode, _AttributeNode, _CallBranch, _ChainState, _CircuitNode, _ConditionalNode, _DefaultNode, _EndNode, _IndexBranch, _NameNode, _KeyBranch, _Leaf, _ListNode, _OptionalBranch, _OptionalList, _ParameterNode, _ParametersAfterNode, _ParameterTail, _ParenItems, _CommaOperandsNode, _PowTailNode, _StepRead, _TailRound, _TokenStream } from './private.ts'
 */

import { error, ok } from '../../../types/result/module.f.js'
import { concat } from '../../../types/list/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.mjs'
import { assert, assertNotNullish } from '../../../asserts/module.f.js'
import { literalWords } from '../../../js/keywords/module.f.js'
import { symbolAt, unmapped } from '../../../ebnf/ast/module.f.js'
import { assignmentOperators } from '../../ast/module.f.js'
import { mapping, parser } from '../../../ebnf/ll1/module.f.mjs'
import { hasEntry } from '../../../types/object/entry/module.f.js'
import {
    afterCase, binaryOpTag, blockContents, simpleStatement, body, bodyNameStatement, callArguments, caseTail, constStatement, module, eagerTail, importBinding, importBindings,
    importStatement, item, lastStatement, letStatement, elements, entries, entry, loopElse, loopStatement, member, moduleStatement, parameterNames, parenItems, symbolOf, template, terminator, unary, unaryOperand, value, values,
} from '../grammar/module.f.mjs'

/**
 * Splits the tokenizer's single final physical `eof` token off a token list.
 *
 * The backend synthesizes its own logical end-of-input, so passing the
 * tokenizer's physical `eof` through as an ordinary symbol would create a
 * second end marker. Dropping it outright would instead lose the source
 * position that a failure *at* physical end has to be reported from, so its
 * metadata is kept aside as `eofMetadata` rather than discarded or
 * refabricated.
 *
 * The tokenizer's contract is exactly one `eof`, in final position; a stream
 * carrying one anywhere else is rejected here rather than parsed.
 *
 * A stream with no `eof` at all has two causes, and they are not reported the
 * same way. A lexical failure — an unterminated string or comment — ends the
 * stream at an `error` token and emits no `eof`, which is the tokenizer working
 * correctly on bad input; that error is passed through with its own position.
 * Anything else missing an `eof` is a genuine contract violation and has no
 * position to report.
 *
 * @type {(tokens: readonly ModuleTokenWithMetadata[]) => Result<_TokenStream, ParseError>}
 */
const splitEof = tokens => {
    const eofIdx = tokens.findIndex(({ token }) => token.kind === 'eof')
    if (eofIdx === -1) {
        const lastToken = tokens[tokens.length - 1]
        return lastToken !== undefined && lastToken.token.kind === 'error'
            // the token's own span survives into the parse error: it is the one
            // failure here that knows how far the offending source runs
            ? error({
                message: 'unexpected token',
                metadata: lastToken.metadata,
                end: lastToken.token.end,
            })
            : error({ message: 'missing end-of-input token', metadata: null })
    }
    const last = tokens.length - 1
    if (eofIdx !== last) {
        return error({ message: 'end-of-input token is not final', metadata: tokens[eofIdx].metadata })
    }
    return ok({ tokens: tokens.slice(0, last), eofMetadata: tokens[last].metadata })
}

// -- reading the tree ---------------------------------------------------------

/**
 * The token at a position: an input symbol, whose metadata is the token.
 *
 * @type {(node: _Leaf) => ModuleTokenWithMetadata}
 */
const tokenAt = node => {
    const { meta } = symbolAt(node)
    assert(hasEntry(meta, 'token'))
    return meta
}

/**
 * What a mapping returned at a position: an output symbol.
 *
 * @type {(node: _Leaf) => Out}
 */
const outAt = node => {
    const { meta } = symbolAt(node)
    assert(hasEntry(meta, 'id'))
    return meta
}

/** The node at a value's position, whether or not a `(` opened it. @type {(node: _Leaf) => Node} */
const nodeAt = node => {
    const out = outAt(node)
    assert(out.id === 'value' || out.id === 'paren')
    return out.node
}

/** @type {(node: _Leaf) => _ParameterTail} */
const parametersAt = node => {
    const out = outAt(node)
    assert(out.id === 'parameters')
    return { fixed: out.fixed, rest: out.rest }
}

/** @type {(node: _Leaf) => Item} */
const itemAt = node => {
    const out = outAt(node)
    assert(out.id === 'item')
    return out.item
}

/** @type {(node: _Leaf) => List<Item>} */
const valuesAt = node => {
    const out = outAt(node)
    assert(out.id === 'values')
    return out.items
}

/** @type {(node: _Leaf) => Member} */
const memberAt = node => {
    const out = outAt(node)
    assert(out.id === 'member')
    return out.member
}

/** @type {(node: _Leaf) => Entry} */
const entryAt = node => {
    const out = outAt(node)
    assert(out.id === 'entry')
    return out.entry
}

/** @type {(node: _Leaf) => List<Entry>} */
const entriesAt = node => {
    const out = outAt(node)
    assert(out.id === 'entries')
    return out.items
}

/**
 * The target a value is where a binding is wanted: its own reading, or
 * `invalid` where a `(` opened it — a group is no binding in a pattern,
 * `const [(a)] = x;` being a syntax error in JavaScript, so the `paren`
 * id is what decides it, at the `(`.
 *
 * @type {(node: _Leaf) => BindingTarget}
 */
const valueTargetAt = node => {
    const out = outAt(node)
    assert(out.id === 'value' || out.id === 'paren')
    return out.id === 'value' ? out.target : ['invalid', out.first]
}

/** @type {(node: _Leaf) => BindingElement} */
const itemTargetAt = node => {
    const out = outAt(node)
    assert(out.id === 'item')
    return out.target
}

/** @type {(node: _Leaf) => List<Element>} */
const elementsAt = node => {
    const out = outAt(node)
    assert(out.id === 'elements')
    return out.items
}

/** @type {(node: _Leaf) => List<BindingElement>} */
const elementTargetsAt = node => {
    const out = outAt(node)
    assert(out.id === 'elements')
    return out.targets
}

/** @type {(node: _Leaf) => BindingProperty} */
const memberTargetAt = node => {
    const out = outAt(node)
    assert(out.id === 'member')
    return out.target
}

/** @type {(node: _Leaf) => BindingProperty} */
const entryTargetAt = node => {
    const out = outAt(node)
    assert(out.id === 'entry')
    return out.target
}

/** @type {(node: _Leaf) => List<BindingProperty>} */
const entryTargetsAt = node => {
    const out = outAt(node)
    assert(out.id === 'entries')
    return out.targets
}

/** A value that is no binding target, at the token it begins with. @type {(first: ModuleTokenWithMetadata) => BindingTarget} */
const invalid = first => ['invalid', first]

/** A name as a binding target, by its token. @type {(token: ModuleTokenWithMetadata) => BindingTarget} */
const named = token => ['name', token]

/** @type {(node: _Leaf) => Import} */
const importAt = node => {
    const out = outAt(node)
    assert(out.id === 'import')
    return out.statement
}

/** @type {(node: _Leaf) => Const} */
const constAt = node => {
    const out = outAt(node)
    assert(out.id === 'const')
    return out.statement
}

/** @type {(node: _Leaf) => NamedStatement} */
const namedAt = node => {
    const out = outAt(node)
    assert(out.id === 'named')
    return out.statement
}

/** @type {(node: _Leaf) => BlockStatement} */
const statementAt = node => {
    const out = outAt(node)
    assert(out.id === 'statement')
    return out.statement
}

/** @type {(node: _Leaf) => Block[1]} */
const endAt = node => {
    const out = outAt(node)
    assert(out.id === 'end')
    return out.end
}

/** @type {(node: _Leaf) => Extract<Out, { readonly id: 'caseTail' }>} */
const caseTailAt = node => {
    const out = outAt(node)
    assert(out.id === 'caseTail')
    return out
}

/** @type {(node: _Leaf) => Extract<Out, { readonly id: 'afterCase' }>} */
const afterCaseAt = node => {
    const out = outAt(node)
    assert(out.id === 'afterCase')
    return out
}

/** @type {(node: _Leaf) => LoopStatement} */
const loopStatementAt = node => {
    const out = outAt(node)
    assert(out.id === 'loopStatement')
    return out.statement
}

/** @type {(node: _Leaf) => Extract<Out, { readonly id: 'last' }>} */
const lastAt = node => {
    const out = outAt(node)
    assert(out.id === 'last')
    return out
}

/** @type {(node: _Leaf) => Module} */
const moduleAt = node => {
    const out = outAt(node)
    assert(out.id === 'module')
    return out.module
}

/**
 * The words that denote a value, which the tokenizer gives token kinds of
 * their own. A name position takes them — a property is named by an
 * ECMAScript `IdentifierName`, which admits every reserved word — and
 * the fold then refuses them where a *binding* is wanted, as it refuses
 * every other keyword.
 *
 * @type {ReadonlySet<string>}
 */
const literalWordSet = new Set(/** @type {readonly string[]} */(literalWords))

/**
 * The word a name token spells. A framing keyword is an identifier too,
 * arriving as the same `id` token; each of the six words that denote a
 * value is a token kind of its own, and *is* its own word. Exported, with
 * {@link textOf}, for the fold in `../module.f.mjs`, which reads the words
 * of the tokens the records here hold.
 *
 * @type {(t: ModuleTokenWithMetadata) => string}
 */
export const nameOf = ({ token }) => {
    if (token.kind === 'id') { return token.value }
    assert(literalWordSet.has(token.kind), token.kind)
    return token.kind
}

/** The text a string token spells. @type {(t: ModuleTokenWithMetadata) => string} */
export const textOf = ({ token }) => {
    assert(token.kind === 'string')
    return token.value
}

/**
 * A primitive is what its branch spells, read off the one token the
 * branch holds: the branch is the token's kind, so the switch is over the
 * grammar's own list of value kinds.
 *
 * @type {(node: Children<typeof primitive, ModuleTokenWithMetadata, Out>) => Primitive}
 */
export const _primitiveOf = ([tag, leaf]) => {
    const { token } = tokenAt(leaf)
    switch (tag) {
        case 'null': { return null }
        case 'true': { return true }
        case 'false': { return false }
        case 'undefined': { return undefined }
        case 'NaN': { return NaN }
        case 'Infinity': { return Infinity }
        case 'number': {
            assert(token.kind === 'number')
            return Number(token.value.replaceAll('_', ''))
        }
        case 'string': {
            assert(token.kind === 'string')
            return token.value
        }
        case 'bigint': {
            assert(token.kind === 'bigint')
            return token.value
        }
        default: { throw ['not a primitive', tag] }
    }
}

/** The cooked text of a template chunk. @type {(node: _Leaf) => string} */
const chunkOf = node => {
    const { token } = tokenAt(node)
    assert(token.kind === 'noSubstitutionTemplate' || token.kind === 'templateHead' || token.kind === 'templateMiddle' || token.kind === 'templateTail')
    return token.value
}

/**
 * A template lowered to concatenations and explicit string conversions in
 * source order, retaining every chunk, including an empty head or tail.
 * Conversion has a syntax node of its own so no reference or source binding
 * can replace it. The AST and EDAG already represent the same operation.
 *
 * @type {(node: Children<Template, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toTemplate = ([tag, branch]) => {
    if (tag === 'plain') {
        const start = tokenAt(branch)
        return symbol({ id: 'value', node: ['primitive', chunkOf(branch)], first: start, target: invalid(start) })
    }
    const [head, firstValue, rounds, tail] = unmapped(branch)
    /** @type {Node} */
    const first = ['+', ['primitive', chunkOf(head)], ['String', nodeAt(firstValue)]]
    const beforeTail = unmapped(rounds).reduce(
        /** @type {(acc: Node, round: Ast<readonly [number, Value], ModuleTokenWithMetadata, Out>) => Node} */
        ((acc, round) => {
            const [chunk, v] = unmapped(round)
            return ['+', ['+', acc, ['primitive', chunkOf(chunk)]], ['String', nodeAt(v)]]
        }), first)
    const start = tokenAt(head)
    return symbol({ id: 'value', node: ['+', beforeTail, ['primitive', chunkOf(tail)]], first: start, target: invalid(start) })
}

/**
 * The items an optional list holds: none, or what the list's mapping
 * returned.
 *
 * @type {<T>(itemsAt: (node: _Leaf) => List<T>) => (node: _OptionalList) => List<T>}
 */
const optionalItems = itemsAt => node => {
    const rounds = unmapped(node)
    return rounds.length === 0 ? null : itemsAt(rounds[0])
}

/**
 * The items of a list node, `item [ ',' [ items ] ]`: the item, then
 * the items the nested list's mapping already returned — so a list of any
 * length costs one step at each of its nodes, and the tree, as deep as the
 * list is long, is never walked.
 *
 * @type {<T>(itemAt: (node: _Leaf) => T, itemsAt: (node: _Leaf) => List<T>) => (node: _ListNode) => List<T>}
 */
const listOf = (itemAt, itemsAt) => {
    const rest = optionalItems(itemsAt)
    return ([item, more]) => {
        const rounds = unmapped(more)
        // no round, or the one holding the comma and the optional rest
        const tail = rounds.length === 0 ? null : rest(unmapped(rounds[0])[1])
        return { first: itemAt(item), tail }
    }
}

/** The items a call's optional list holds. */
const valueItems = optionalItems(valuesAt)

/** The elements an array's optional list holds. */
const elementItems = optionalItems(elementsAt)

/** The entries an object's optional list holds. */
const entryItems = optionalItems(entriesAt)

/** The targets an array's optional list holds, beside its elements. */
const elementTargets = optionalItems(elementTargetsAt)

/** The targets an object's optional list holds, beside its entries. */
const entryTargets = optionalItems(entryTargetsAt)

/** The items of a list of values, its tail already mapped. */
const valuesOf = listOf(itemAt, valuesAt)

/** The elements of an array's list from an item on, its tail already mapped. @type {(node: _ListNode) => List<Element>} */
const elementsOf = listOf(itemAt, elementsAt)

/** The targets of an array's list from an item on, beside its elements. */
const elementTargetsOf = listOf(itemTargetAt, elementTargetsAt)

/** The targets of a list of entries, beside its entries. */
const entryTargetsOf = listOf(entryTargetAt, entryTargetsAt)

/**
 * The pattern an array or an object literal is where a binding is wanted:
 * its bracket, and the targets its list's mapping kept beside the items,
 * `[ open [ items ] close ]`'s list at the second position.
 *
 * @type {(tag: 'array' | 'object', open: ModuleTokenWithMetadata, list: _OptionalList) => BindingTarget}
 */
const containerTarget = (tag, open, list) => {
    if (tag === 'array') { return ['array', open, toArray(elementTargets(list))] }
    return ['object', open, toArray(entryTargets(list))]
}

/** The end of a parameter list, where nothing follows the comma: no fixed parameter and no rest. @type {_ParameterTail} */
const noParameters = { fixed: null, rest: null }

/** The parameters a list's optional tail holds after the comma, `[ parameters ]`: none where the comma is trailing. @type {(node: _OptionalList) => _ParameterTail} */
const parameterItems = node => {
    const rounds = unmapped(node)
    return rounds.length === 0 ? noParameters : parametersAt(rounds[0])
}

/** The parameters after a parameter, `[ ',' [ parameters ] ]`: none where no comma follows it. @type {(node: _ParametersAfterNode) => _ParameterTail} */
const parametersAfter = node => {
    const rounds = unmapped(node)
    // no round, or the one holding the comma and the optional rest of the list
    return rounds.length === 0 ? noParameters : parameterItems(unmapped(rounds[0])[1])
}

/**
 * A fixed parameter from its target and its default, `[ '=' value ]`: the
 * target alone where it has none, and otherwise the target with the `=`
 * and the value, {@link Parameter}.
 *
 * @type {(target: BindingTarget, init: _DefaultNode) => Parameter}
 */
const parameterWith = (target, init) => {
    const rounds = unmapped(init)
    if (rounds.length === 0) { return target }
    const [eq, v] = unmapped(rounds[0])
    return ['=', target, tokenAt(eq), nodeAt(v)]
}

/**
 * What a `(` value `,` holds after the comma where nothing follows it: no
 * item, and the comma trailing.
 *
 * @type {(trailing: boolean) => _ParenItems}
 */
const noParenItems = trailing => ({ fixed: null, rest: null, operands: null, refusal: null, trailing })

/** @type {(node: _Leaf) => _ParenItems} */
const parenItemsAt = node => {
    const out = outAt(node)
    assert(out.id === 'parenItems')
    return out
}

/** The items a `(` value `,` holds after the comma, `[ parenItems ]`: none, a trailing comma, where nothing follows it. @type {(node: _OptionalList) => _ParenItems} */
const parenItemsOf = node => {
    const rounds = unmapped(node)
    return rounds.length === 0 ? noParenItems(true) : parenItemsAt(rounds[0])
}

/** The items after an item, `[ ',' [ parenItems ] ]`: none where no comma follows it. @type {(node: _ParametersAfterNode) => _ParenItems} */
const parenItemsAfter = node => {
    const rounds = unmapped(node)
    return rounds.length === 0 ? noParenItems(false) : parenItemsOf(unmapped(rounds[0])[1])
}

/**
 * A comma's node from its operands and what refuses it, or the one
 * operand's own where there is no other: a group is no node of its own.
 *
 * @type {(operands: readonly Node[], refusal: ModuleTokenWithMetadata | null) => Node}
 */
const comma = (operands, refusal) => operands.length === 1 && refusal === null ? operands[0] : [',', operands, refusal]

/**
 * A group's value from the value at its first position and the operands
 * after it, `value { ',' value }`: the value alone, or the comma over all
 * of them.
 *
 * @type {(v: _Leaf, more: _CommaOperandsNode) => Node}
 */
const grouped = (v, more) => comma([nodeAt(v), ...unmapped(more).map(round => nodeAt(unmapped(round)[1]))], null)

/** The entries of a list of entries, its tail already mapped. */
const entriesOf = listOf(entryAt, entriesAt)

/** @type {(out: Out) => Meta<Out>} */
const symbol = out => ({ symbol: 0, meta: out })

/**
 * The token a property names its key by: `.name`'s identifier, at the
 * second position of the branch, under the identifier's own alternative.
 *
 * @type {(branch: _KeyBranch) => ModuleTokenWithMetadata}
 */
const accessKey = branch => tokenAt(unmapped(unmapped(branch)[1])[1])

/**
 * The key a value in brackets names, an index's or a pattern property's:
 * the token of a string or a number literal standing alone, a constant key
 * as `.name`'s word is — what its name is read from, and what a refusal of
 * the name is anchored at — and any other value a computed key, with the
 * token it begins with. A group is no constant, `a[("x")]` being a value
 * the reader cannot tell from any other.
 *
 * @type {(node: _Leaf) => Key}
 */
const bracketKey = node => {
    const out = outAt(node)
    const { node: value, first } = /** @type {Extract<Out, { readonly node: Node }>} */ (out)
    const { kind } = first.token
    return out.id === 'value' && value[0] === 'primitive' && (kind === 'string' || kind === 'number') ? first : ['[]', value, first]
}

/**
 * The key an index names, `[ value ]`, the value at the second position,
 * {@link bracketKey}.
 *
 * @type {(branch: _IndexBranch) => Key}
 */
const indexKey = branch => bracketKey(unmapped(branch)[1])

/**
 * A function's parameter list where it begins with no value: the rest
 * parameter, its token the identifier at the second position of
 * `... id`, under the alternative its word matched, as a `const`'s
 * name is — or the empty list, which has no token, and the fold has no
 * word to bind, so a body under it names nothing.
 *
 * @type {(node: _ParameterNode) => Parameters}
 */
const parameterOf = node => {
    const rounds = unmapped(node)
    return { fixed: [], rest: rounds.length === 0 ? null : tokenAt(unmapped(unmapped(rounds[0])[1])[1]) }
}

/**
 * A named parameter list from the value at its head, the head's default
 * where it has one, and the parameters after it: the head is a parameter
 * where it is a binding target — a name, or a pattern, read off the value
 * as a `const`'s is, and not one a `(` opened again, `((a)) => 1` being a
 * syntax error in JavaScript — and otherwise the list is malformed,
 * anchored at the `(` that opened it for the fold to refuse. A value that
 * is no target inside a pattern, `([(a)]) => 1`, is the pattern's to carry
 * and the fold's to refuse where it stands, as it is in a `const`.
 *
 * @type {(open: ModuleTokenWithMetadata, head: _Leaf, init: (target: BindingTarget) => Parameter, more: _ParameterTail) => ParameterList}
 */
const namedList = (open, head, init, more) => {
    const out = outAt(head)
    if (out.id !== 'value' || out.target[0] === 'invalid') { return { invalid: open } }
    return { fixed: [init(out.target), ...toArray(more.fixed)], rest: more.rest }
}

/** A head with no default: the target itself. @type {(target: BindingTarget) => Parameter} */
const bare = target => target

/**
 * One step as written: a property by the token its key is read from, or a
 * call by its arguments — the optional list at the second position of
 * `( [ items(value) ] )`, read as an array's items are — and whether a
 * `?.` guards it. An optional step holds the same three one level further
 * in, under the `?.`: its property is the name alone, so its token is one
 * level nearer than {@link accessKey} reads.
 *
 * @type {(round: _AccessNode) => _StepRead}
 */
const stepOf = round => {
    const [tag, branch] = unmapped(round)
    if (tag === 'call') { return { optional: false, key: null, items: toArray(valueItems(unmapped(/** @type {_CallBranch} */(branch))[1])) } }
    if (tag === 'index') { return { optional: false, key: indexKey(/** @type {_IndexBranch} */(branch)), items: null } }
    if (tag !== 'optional') { return { optional: false, key: accessKey(/** @type {_KeyBranch} */(branch)), items: null } }
    const [kind, step] = unmapped(unmapped(/** @type {_OptionalBranch} */(branch))[1])
    if (kind === 'call') { return { optional: true, key: null, items: toArray(valueItems(unmapped(/** @type {_CallBranch} */(step))[1])) } }
    if (kind === 'index') { return { optional: true, key: indexKey(/** @type {_IndexBranch} */(step)), items: null } }
    return { optional: true, key: tokenAt(unmapped(/** @type {_NameNode} */(step))[1]), items: null }
}

/**
 * The state a chain's steps leave it in: whether a receiver is live — the
 * value is a property reference, which a call after it keeps as `this` —
 * and whether a short-circuit region is open, the two bits of
 * `fjs/edag/README.md`'s Chains. A `?.` node opens a region with a
 * receiver, a `?.()` node one without, and a step moves the bits as the
 * README's table says: a property sets the receiver, a call spends it, a
 * guarded call opens the region again and the escaping call closes it.
 *
 * @type {(state: _ChainState, step: Step | undefined) => _ChainState}
 */
const after = (state, step) => {
    if (step === undefined) { return state }
    switch (step[0]) {
        case '|.': { return after({ receiver: true, open: state.open }, step[2]) }
        case '|()': { return after({ receiver: false, open: state.open }, step[2]) }
        case '|?.()': { return after({ receiver: false, open: true }, step[2]) }
        default: { return { receiver: false, open: false } }
    }
}

/** The state a node's steps leave it in; a node that is no chain has no bit live but an access's receiver. @type {(node: Node) => _ChainState} */
const stateOf = node => {
    switch (node[0]) {
        case '?.': { return after({ receiver: true, open: true }, node[3]) }
        case '?.()': { return after({ receiver: false, open: true }, node[3]) }
        case '.': { return after({ receiver: true, open: false }, node[3]) }
        default: { return { receiver: false, open: false } }
    }
}

/** The steps with one more at their end. @type {(steps: Step, step: Step) => Step} */
const continuedSteps = (steps, step) => {
    const [tag, x, next] = steps
    return /** @type {Step} */ (next === undefined ? [tag, x, step] : [tag, x, continuedSteps(next, step)])
}

/**
 * A chain with one more step at its end: the node's fourth element, or
 * the end of the steps it already has.
 *
 * @type {(node: Chain | readonly ['.', Node, Key], step: Step) => Chain}
 */
const appended = (node, step) => {
    const [tag, base, x, k] = node
    return /** @type {Chain} */ (k === undefined ? [tag, base, x, step] : [tag, base, x, continuedSteps(k, step)])
}

/**
 * One step applied to the node before it. What a step applies to is
 * everything written before it, which is what folding them in order says:
 * `a.b(1)[0]` is the index of the call of the access, and `f(1)(2)` is the
 * call of the call. A plain step on a plain value is a node over it, an
 * access or a call, and a group is no boundary there — the step reads the
 * value inside it, so `(a.b)(c)` is the node `a.b(c)` is.
 *
 * A `?.` opens a short-circuit region, and the steps after it, until a
 * group closes it, are the chain's own continuation rather than nodes over
 * it — `a?.b.c` is one `?.` node with a `|.` step, since a nullish `a`
 * skips `.c` too — in the shapes `fjs/edag/README.md`'s Chains gives each
 * spelling. `closed` is the group: `(a?.b).c` is an access over the chain,
 * `(a?.b)(c)` the escaping call, `|!()`, which keeps the receiver the
 * parentheses kept, and `(a?.b)?.(c)` the guarded call `a?.b?.(c)` is,
 * since a region closed before a guard is unobservable. A guarded access
 * always starts a node, `a?.b?.c` being a `?.` over a `?.`, and so does a
 * guarded call where no receiver is live, `a?.(b)?.(c)`; a guarded call on
 * a plain access is that access's own step, `a.b?.(c)`, the receiver kept.
 *
 * @type {(closed: boolean) => (base: Node, round: _AccessNode) => Node}
 */
const accessed = closed => (base, round) => {
    const { optional, key, items } = stepOf(round)
    const { receiver, open } = stateOf(base)
    if (key !== null) {
        return open && !closed && !optional
            ? appended(/** @type {Chain} */ (base), ['|.', key])
            : [optional ? '?.' : '.', base, key]
    }
    const args = /** @type {readonly Item[]} */ (items)
    // a guarded call keeps a live receiver as the node's own step, in an
    // open region or one a group closed alike; with none live it starts a node
    if (optional) { return receiver ? appended(/** @type {Chain | readonly ['.', Node, Key]} */ (base), ['|?.()', args]) : ['?.()', base, args] }
    if (!open) { return ['()', base, args] }
    if (!closed) { return appended(/** @type {Chain} */ (base), ['|()', args]) }
    return receiver ? appended(/** @type {Chain} */ (base), ['|!()', args]) : ['()', base, args]
}

/**
 * A value's own part and the steps written after it, each applied to
 * everything before it: the node the last of them leaves. `closed` says
 * the value was a group, which the first step alone reads
 * ({@link accessed}): the steps after it apply to the node that step left.
 *
 * @type {(base: Node, accesses: readonly _AccessNode[], closed: boolean) => Node}
 */
const steps = (base, accesses, closed) => accesses.reduce((node, round, i) => accessed(closed && i === 0)(node, round), base)

/**
 * `**`'s round, when a primitive, a reference, an array, an object or a
 * group is raised to a power: the operand at the second position of `'**'
 * unary`, under the one round the option holds.
 *
 * @type {(base: Node, powTail: _PowTailNode) => Node}
 */
const withPow = (base, powTail) => {
    const rounds = unmapped(powTail)
    if (rounds.length === 0) { return base }
    const [, v] = unmapped(rounds[0])
    return ['**', base, nodeAt(v)]
}

/**
 * One binary layer's rounds folded onto `base`, left-associative: each
 * round is `op unary tail*`, its own trailing tail lists — one per layer
 * below this one — read the same way {@link applyLayers} reads a value's
 * own, so a round's right operand is its `unary` with everything below
 * this layer already applied to it, `1 + 2 * 3` folding `2 * 3` before
 * `+` ever sees it. A lazy operator's round is the same shape — `a || b
 * && c` folds `b && c` first, its `&&` list trailing the `||` round —
 * and laziness is no shape difference at this layer, the tag alone
 * saying which operator a node is.
 *
 * @type {(base: Node, rounds: readonly _TailRound[]) => Node}
 */
const foldLayer = (base, rounds) => rounds.reduce((left, round) => {
    const [opChoice, v, ...lowerTails] = unmapped(round)
    const [opTag, op] = unmapped(opChoice)
    const right = applyLayers(nodeAt(v), lowerTails)
    // every round's operator is a rule the grammar made from the same
    // records, so a name the map lacks is the grammar's bug, not the input's
    const tag = assertNotNullish(binaryOpTag[opTag], ['binary operator without a tag', opTag])
    // `instanceof` keeps its operator token: the fold refuses a right
    // operand that is no reference to `Array` there, where every spelling
    // of the right side has a token
    return tag === 'instanceof' ? [tag, left, right, tokenAt(op)] : [tag, left, right]
}, base)

/**
 * `base` through the binary layers given, each a repeat of rounds, lowest
 * first: the eight eager lists of a value's own tail, or the lists
 * trailing a round — the same shape one layer down, which is what lets
 * {@link foldLayer} reuse this for a round's right operand — or the lists
 * a short-circuit chain continues with after its first round.
 *
 * @type {(base: Node, tailLists: readonly _Leaf[]) => Node}
 */
const applyLayers = (base, tailLists) => tailLists.reduce(tailStep, base)

/**
 * The short-circuit level folded onto `base`: nothing, or the chain the
 * first operator committed to, `[ && round { && round } { || round } | ||
 * round { || round } | ?? round { ?? round } ]` — the branch's own round
 * folded as any layer's round is, since it is one, and the repeat lists
 * after it applied to that as {@link applyLayers} applies a value's own.
 * The branch's tag says nothing the round's own operator does not, so the
 * reader never looks at it; which chains may follow which is the grammar's
 * shape, decided before this reader sees a node.
 *
 * @type {(base: Node, circuit: _CircuitNode) => Node}
 */
const applyCircuit = (base, circuit) => {
    const rounds = unmapped(circuit)
    if (rounds.length === 0) { return base }
    const [, branch] = unmapped(rounds[0])
    const [round, ...tailLists] = unmapped(branch)
    return applyLayers(foldLayer(base, [round]), tailLists)
}

/**
 * The conditional folded onto `base`: nothing, or `? value : value`, the
 * arms at the second and fourth positions of the one round the option
 * holds — each a whole value already mapped, so a nested conditional in
 * either arm is a node here and never a call, however deep the source
 * nests them.
 *
 * @type {(base: Node, conditional: _ConditionalNode) => Node}
 */
const applyConditional = (base, conditional) => {
    const rounds = unmapped(conditional)
    if (rounds.length === 0) { return base }
    const [, t, , e] = unmapped(rounds[0])
    return ['?:', base, nodeAt(t), nodeAt(e)]
}

/**
 * `base` through the whole suffix `value`/`body` spread onto every branch
 * that may carry one, `func` and `block` excepted: the eight eager layers
 * first, `multiplicative` through `bitwiseOr`, then the short-circuit
 * level, then the conditional — split at the eager list's own length,
 * since the grammar spreads the eight and the two lazy positions into one
 * sequence and the two are not repeats of rounds. Or no suffix at all:
 * `unary`'s branches are `value`'s without one, read by the same reader,
 * {@link toNode}.
 *
 * @type {(base: Node, tail: readonly _Leaf[]) => Node}
 */
const applyTail = (base, tail) => {
    if (tail.length === 0) { return base }
    // the two positions are typed by their shape, as `tailStep`'s round is
    // and for the reason given there: `_Leaf` is what a spread position
    // knows of itself
    const [circuit, conditional] = tail.slice(eagerTail.length)
    const eager = applyLayers(base, tail.slice(0, eagerTail.length))
    return applyConditional(applyCircuit(eager, /** @type {_CircuitNode} */ (circuit)), /** @type {_ConditionalNode} */ (conditional))
}

/**
 * One tail list applied to the accumulator so far.
 *
 * `unmapped` infers its return type from `_Leaf`'s own array member here,
 * `readonly unknown[]`, rather than from `foldLayer`'s expected one: a
 * generic call's type argument is inferred from its own argument before
 * the position it is handed to is considered. The round shape this reads
 * is `_TailRound`'s, unmapped one level further in by {@link foldLayer}
 * itself, so the cast states what {@link _TailRound} already documents,
 * rather than a new claim. {@link applyCircuit}'s round is read through
 * the same type for the same reason.
 *
 * @type {(acc: Node, rounds: _Leaf) => Node}
 */
const tailStep = (acc, rounds) => foldLayer(acc, /** @type {readonly _TailRound[]} */ (unmapped(rounds)))

/**
 * The node a value's own part makes, before the accesses, the power and the
 * binary layers above it: a primitive converted from its token, a reference
 * by its token, and a container of the items its list returned — `[ open
 * [ items ] close ]`, the list at the second position, under the
 * `[thing, accesses]` pair every one of these branches opens with, at the
 * first position of the branch itself. What a `(` opens, a name, a block,
 * the prefixes are not here: each takes no access of its own, so its node
 * is made whole in {@link toNode}, and a group's
 * value is reached through {@link parenNode}.
 *
 * Takes the whole node, tag and branch together, rather than a pre-peeled
 * `x`: the branch narrows by `tag` only inside the discriminated union
 * `Children<Unary | UnaryOperand | Value | Body, …>` still is at this
 * position, which is what lets the second `unmapped` below see a precise
 * shape instead of `unknown`. `UnaryOperand`'s own four leaves are wrapped
 * one tuple deep for exactly this reason — see its own comment in
 * `./grammar/module.f.mjs` — so the same reads serve both rules.
 *
 * @type {(node: Exclude<Children<Unary, ModuleTokenWithMetadata, Out> | Children<UnaryOperand, ModuleTokenWithMetadata, Out> | Children<Value, ModuleTokenWithMetadata, Out> | Children<Body, ModuleTokenWithMetadata, Out>, readonly ['paren' | 'group' | 'block' | 'neg' | 'bitnot' | 'not' | 'typeof' | 'name', unknown]>) => Node}
 */
export const _baseOf = ([tag, branch]) => {
    switch (tag) {
        case 'primitive': {
            const x = unmapped(branch)[0]
            const p = unmapped(x)[0]
            return ['primitive', _primitiveOf(unmapped(p))]
        }
        case 'template': {
            const x = unmapped(branch)[0]
            return nodeAt(unmapped(x)[0])
        }
        case 'ref': {
            const x = unmapped(branch)[0]
            const p = unmapped(x)[0]
            return ['ref', tokenAt(unmapped(p)[1])]
        }
        case 'array': {
            const x = unmapped(branch)[0]
            const a = unmapped(x)[0]
            return ['array', toArray(elementItems(unmapped(a)[1]))]
        }
        case 'object': {
            const x = unmapped(branch)[0]
            const o = unmapped(x)[0]
            return ['object', toArray(entryItems(unmapped(o)[1]))]
        }
        default: { throw ['not a value base', tag] }
    }
}

/**
 * The token a value begins with, `first` of what its mapping returned,
 * whether or not a `(` opened it: what a `return` asks for its line.
 *
 * @type {(node: _Leaf) => ModuleTokenWithMetadata}
 */
const firstAt = node => {
    const out = outAt(node)
    assert(out.id === 'value' || out.id === 'paren')
    return out.first
}

/**
 * The token a value's own part begins with: a primitive's or a name's own
 * token, under the alternative it matched, or a container's opening
 * bracket, the first symbol of `[ open [ items ] close ]`.
 *
 * @type {(tag: 'primitive' | 'template' | 'ref' | 'array' | 'object', base: _Leaf) => ModuleTokenWithMetadata}
 */
const baseFirst = (tag, base) => tag === 'template' ? firstAt(base) : tokenAt(/** @type {_Leaf} */ (unmapped(base)[tag === 'array' || tag === 'object' ? 0 : 1]))

/**
 * A function's parameter list against its `=>`: the list, or the `=>`
 * where a newline precedes it, which JavaScript forbids — `a\n=> 1` is a
 * syntax error there — for the fold to refuse at the `=>`. A list already
 * malformed keeps its own refusal, which comes first in the source.
 *
 * @type {(list: ParameterList, arrow: ModuleTokenWithMetadata) => ParameterList}
 */
const arrowed = (list, arrow) => hasEntry(list, 'invalid') || !arrow.newline ? list : { arrow }

/**
 * What follows a name or a `( value )`, `arrowOrRest`: the function whose
 * one parameter it is, by the `=>` and the body of `=> body`, `list`
 * being that parameter — or the value with the steps at the first
 * position of `access* powTail tail`, the power at the second and the
 * binary layers after them applied, exactly as {@link toNode} applies a
 * value's own, `closed` saying the value was a group, which the first
 * step after it reads ({@link steps}).
 *
 * @type {(list: ParameterList, base: Node, closed: boolean, node: Ast<ArrowOrRest, ModuleTokenWithMetadata, Out>) => Node}
 */
const continued = (list, base, closed, node) => {
    const [tag, branch] = unmapped(node)
    if (tag === 'func') {
        const [arrow, b] = unmapped(branch)
        return ['=>', arrowed(list, tokenAt(arrow)), nodeAt(b)]
    }
    const [accesses, powTail, ...tailLists] = unmapped(branch)
    return applyTail(withPow(steps(base, unmapped(accesses), closed), powTail), tailLists)
}

/**
 * What a `(` opened, at the second position of `( (func | value afterValue)`:
 * a function whose list begins with no value, by that list at the first
 * position of `[ ... id ] ) => body`, its `=>` at the third and its body
 * at the fourth — or a value and what follows it: `,`, the items after the
 * value and then {@link continued} at the fourth position of
 * `, [ parenItems ] ) arrowOrRest`, the value heading a named list where
 * `=>` follows and a comma's operands where anything else does; `=`, the
 * value's default at the second position of
 * `= value [ , [ names ] ] ) => body`, the names after it, the `=>` at the
 * fifth and the body at the sixth, the value heading a named list with
 * that default; or `)` and then {@link continued}, the value the one
 * parameter or a group. Each `=>` is checked against its line,
 * {@link arrowed}.
 *
 * A group is no node of its own: `(x)` is whatever `x` is, and the steps
 * after the `)` apply to that same node, so nothing downstream can tell a
 * group was written. That is what JavaScript means by parentheses — they
 * keep even a property reference, so `(a.b)(c)` passes `a` as `a.b(c)`
 * does — and it leaves a group no canonical form to choose. The one
 * reader that has to know is {@link namedList}, and the `paren` id of
 * this rule's own output is what tells it.
 *
 * @type {(open: ModuleTokenWithMetadata, node: Children<Parenthesized, ModuleTokenWithMetadata, Out>) => Node}
 */
const parenNode = (open, [tag, branch]) => {
    if (tag === 'func') {
        const [p, , arrow, b] = unmapped(branch)
        return ['=>', arrowed(parameterOf(p), tokenAt(arrow)), nodeAt(b)]
    }
    const [v, after] = unmapped(branch)
    const [kind, rest] = unmapped(after)
    if (kind === 'list') {
        // the items read both ways, and what follows the `)` deciding: an
        // arrow's parameters, or a comma's operands — refused at the first
        // token no operand list holds, a trailing comma's at the `)`
        const [, items, close, next] = unmapped(rest)
        const more = parenItemsOf(items)
        const refusal = more.refusal ?? (more.trailing ? tokenAt(close) : null)
        const list = namedList(open, v, bare, { fixed: more.fixed, rest: more.rest })
        return continued(list, comma([nodeAt(v), ...toArray(more.operands)], refusal), true, next)
    }
    if (kind === 'default') {
        const [eq, d, more, , arrow, b] = unmapped(rest)
        /** @type {(target: BindingTarget) => Parameter} */
        const init = target => ['=', target, tokenAt(eq), nodeAt(d)]
        return ['=>', arrowed(namedList(open, v, init, parametersAfter(more)), tokenAt(arrow)), nodeAt(b)]
    }
    const [, next] = unmapped(rest)
    return continued(namedList(open, v, bare, noParameters), nodeAt(v), true, next)
}

/**
 * A group's node, from `value { ',' value } ) access* '**' unary`: the
 * value at the first position, or the comma over it and the operands at
 * the second, {@link grouped}, the steps after the `)` at the fourth
 * applied to it, and the power at the fifth raised over that.
 *
 * @type {(node: Ast<Group, ModuleTokenWithMetadata, Out>) => Node}
 */
const groupNode = node => {
    const [v, more, , accesses, powTail] = unmapped(node)
    return withPow(steps(grouped(v, more), unmapped(accesses), true), powTail)
}

/**
 * The operator each prefix branch of the grammar reads: `neg`, `bitnot`,
 * `not` and `typeof` are `-`, `~`, `!` and `typeof`, the tags `../ast` and
 * the EDAG share.
 */
const prefixOps = /** @type {const} */ ({ neg: '-', bitnot: '~', not: '!', typeof: 'typeof' })

/**
 * A value is the node its branch made, with each access after it, the
 * power over it and the binary layers above it applied in turn — or what a
 * `(` opened, {@link parenNode}. A body is a value less the object, and its
 * node is made the same way; `unary` is a value less every binary layer,
 * its every branch the same but for the trailing tail lists none of them
 * carry, which is what tells this reader whether to call {@link applyTail}
 * at all.
 *
 * A block preserves its ordered `const` declarations and the explicit
 * `return` or `throw` that ends it, including when no declaration precedes
 * it. The source tree keeps that syntax until the fold lowers it to an
 * executable function body.
 *
 * A prefix is `op t unary tail*`, `unary` at the third position exactly as
 * a binary layer's own round has it — the prefix applied first, then the
 * tail lists above that, `-2 * 3`
 * reading `(-2) * 3` and not `-(2 * 3)`.
 *
 * @type {(node: Children<Unary, ModuleTokenWithMetadata, Out> | Children<Value, ModuleTokenWithMetadata, Out> | Children<Body, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toNode = node => {
    if (node[0] === 'paren') {
        const [open, p] = unmapped(node[1])
        const first = tokenAt(open)
        return symbol({ id: 'paren', node: parenNode(first, unmapped(p)), first })
    }
    if (node[0] === 'name') {
        const [id, after] = unmapped(node[1])
        const token = tokenAt(unmapped(id)[1])
        const made = continued({ fixed: [named(token)], rest: null }, ['ref', token], false, after)
        // the name alone is a target; with a step, an operator or an `=>`
        // after it, it is the value those make
        return symbol({ id: 'value', node: made, first: token, target: made[0] === 'ref' ? named(token) : invalid(token) })
    }
    if (node[0] === 'group') {
        const [open, g] = unmapped(node[1])
        const first = tokenAt(open)
        return symbol({ id: 'value', node: groupNode(g), first, target: invalid(first) })
    }
    if (node[0] === 'neg' || node[0] === 'bitnot' || node[0] === 'not' || node[0] === 'typeof') {
        const [op, v, ...tailLists] = unmapped(node[1])
        const first = tokenAt(op)
        return symbol({ id: 'value', node: applyTail([prefixOps[node[0]], nodeAt(v)], tailLists), first, target: invalid(first) })
    }
    if (node[0] === 'block') {
        const [block, first] = blockOf(unmapped(node[1]))
        return symbol({ id: 'value', node: block, first, target: invalid(first) })
    }
    const x = unmapped(node[1])[0]
    const [base, accesses] = unmapped(x)
    const [, powTail, ...tailLists] = unmapped(node[1])
    const made = applyTail(withPow(steps(_baseOf(node), unmapped(accesses), false), powTail), tailLists)
    const first = baseFirst(node[0], base)
    // an array or an object literal is a pattern where nothing follows it
    // — a step, a power or an operator makes it the value those make, and
    // changes its node's tag — and a `unary`'s bare name is a target as a
    // value's is; everything else is no target
    const target = (node[0] === 'array' || node[0] === 'object') && made[0] === node[0]
        ? containerTarget(node[0], first, /** @type {_OptionalList} */ (unmapped(base)[1]))
        : made[0] === 'ref' ? named(made[1]) : invalid(first)
    return symbol({ id: 'value', node: made, first, target })
}

/**
 * A prefix's own operand: {@link unaryOperand}'s branches, read the same
 * way {@link toNode} reads {@link unary}'s but for the power and the
 * binary layers above it, neither of which this rule's grammar admits — a
 * further prefix, recursing through this same reader by way of
 * {@link nodeAt}, {@link unaryOperand} mapped here exactly as {@link
 * unary} is by `toNode`; a group, whose own steps apply with no power past
 * the `)`; or the base itself, through {@link _baseOf}, with only the
 * accesses after it applied.
 *
 * @type {(node: Children<UnaryOperand, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const operandToNode = node => {
    if (node[0] === 'neg' || node[0] === 'bitnot' || node[0] === 'not' || node[0] === 'typeof') {
        const [op, v] = unmapped(node[1])
        const first = tokenAt(op)
        return symbol({ id: 'value', node: [prefixOps[node[0]], nodeAt(v)], first, target: invalid(first) })
    }
    if (node[0] === 'group') {
        const [open, g] = unmapped(node[1])
        const [v, more, , accesses] = unmapped(g)
        const first = tokenAt(open)
        return symbol({ id: 'value', node: steps(grouped(v, more), unmapped(accesses), true), first, target: invalid(first) })
    }
    const x = unmapped(node[1])[0]
    const [base, accesses] = unmapped(x)
    const first = baseFirst(node[0], base)
    // a prefix's operand stands in no binding position, so it is no target
    return symbol({ id: 'value', node: steps(_baseOf(node), unmapped(accesses), false), first, target: invalid(first) })
}

/**
 * A block from its children, `{`, the retained body contents and `}`:
 * its ordered statements, `const`s and guards, then what ends it, the
 * terminator's own record, {@link toEnd} — and the `{` it begins at. A
 * function's body, a guard's block and a case's are read the same way.
 *
 * @type {(node: Children<BlockRule, ModuleTokenWithMetadata, Out>) => readonly [Block, ModuleTokenWithMetadata]}
 */
const blockOf = ([open, contents]) => [['block', blockContentsAt(contents)], tokenAt(open)]

/** @type {(node: _Leaf) => Block[1]} */
const blockContentsAt = node => {
    const out = outAt(node)
    assert(out.id === 'blockContents')
    return out.statements
}

/** @type {(node: Children<BlockContents, ModuleTokenWithMetadata, Out>) => Meta<Out>} */
const toBlockContents = ([statements, ending]) => {
    const prefix = unmapped(statements).map(statementAt)
    const [kind, branch] = unmapped(ending)
    if (kind === 'end') { return symbol({ id: 'blockContents', statements: [...prefix, ...endAt(branch)] }) }
    const [loop, tail] = unmapped(branch)
    const following = unmapped(tail)[0]
    const read = loopConditionAt(loop)
    return symbol({ id: 'blockContents', statements: following === undefined
        ? [...prefix, ['terminal-while', read]]
        : [...prefix, ['while', read], ...blockContentsAt(following)] })
}

/**
 * What ends a block, from the terminator's children: the `return` or
 * `throw`, tagged by its keyword, one statement; or the switch — the
 * `switch` it begins at, its discriminant, and its first case closed over
 * its first label, {@link closedCase}, which carries every case after it
 * and what ends the switch: a `default` block, which ends the block the
 * switch stands in; or the rest of that block, this record again, put
 * after the switch — so that a block is one flat list whatever its
 * switches hold, and the fold reads the statements after a switch where
 * it reads the statements after a guard.
 *
 * @type {(node: Children<Terminator, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toEnd = node => {
    // destructured here rather than in the parameter list, where
    // narrowing on `kind` would not reach `branch`
    const [kind, branch] = node
    if (kind === 'return') { return symbol({ id: 'end', end: [['return', valueStatementOf(unmapped(branch))]] }) }
    if (kind === 'throw') { return symbol({ id: 'end', end: [['throw', valueStatementOf(unmapped(branch))]] }) }
    const [first, , discriminant, , , , label, , tail] = unmapped(branch)
    const { cases, end } = closedCase(nodeAt(label), caseTailAt(tail))
    const read = { start: tokenAt(first), discriminant: nodeAt(discriminant), cases: toArray(cases) }
    return symbol({ id: 'end', end: end[0] === 'default' ? [['switch', { ...read, default: end[1] }]] : [['switch', { ...read, default: null }], ...end[1]] })
}

/**
 * A case closed over its first label, from the record of its tail: the
 * label before the ones the tail read, the case before the ones closed
 * after it, and what ends the switch as the tail has it.
 *
 * @type {(label: Node, tail: Extract<Out, { readonly id: 'caseTail' }>) => Extract<Out, { readonly id: 'afterCase' }>}
 */
const closedCase = (label, { labels, block, cases, end }) =>
    ({ id: 'afterCase', cases: { first: { labels: [label, ...toArray(labels)], block }, tail: cases }, end })

/**
 * A case's tail, from its children: a label, put before the ones the tail
 * after it read, the case still open; or the case's block, read as a
 * body's, and what follows the case, {@link toAfterCase}, which opens the
 * case with no label yet. Each mapping reads one node and puts one item
 * before what its tail's mapping returned, as a list's does, so a switch
 * of thousands of cases or of labels, which the grammar reads as that
 * many levels, is read on the machine's heap stack and not the host's
 * (`stackSafety` in `../proof.f.mjs`).
 *
 * @type {(node: Children<CaseTail, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toCaseTail = node => {
    const [which, branch] = node
    if (which === 'case') {
        const [, label, , next] = unmapped(branch)
        const tail = caseTailAt(next)
        return symbol({ ...tail, labels: { first: nodeAt(label), tail: tail.labels } })
    }
    const [blk, after] = unmapped(branch)
    return symbol({ ...afterCaseAt(after), id: 'caseTail', labels: null, block: blockOf(unmapped(blk))[0] })
}

/**
 * What follows a case's block, from its children: the next case, closed
 * over its first label as the first case is, {@link closedCase}; the
 * `default` block, read as a body's, which ends the switch and the block
 * it stands in; or the rest of that block, its statements and its end,
 * which follow the switch in it.
 *
 * @type {(node: Children<AfterCase, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toAfterCase = node => {
    const [which, branch] = node
    if (which === 'case') {
        const [, label, , next] = unmapped(branch)
        return symbol(closedCase(nodeAt(label), caseTailAt(next)))
    }
    if (which === 'default') {
        const [, , blk] = unmapped(branch)
        return symbol({ id: 'afterCase', cases: null, end: ['default', blockOf(unmapped(blk))[0]] })
    }
    const [, contents] = unmapped(branch)
    return symbol({ id: 'afterCase', cases: null, end: ['rest', blockContentsAt(contents)] })
}

/**
 * A loop's block from its children, `{`, the statements and `}`: its
 * statements in order, `const`s and assignments.
 *
 * @type {(node: Children<LoopBlockRule, ModuleTokenWithMetadata, Out>) => LoopBlock}
 */
const loopBlockOf = ([, statements]) => ['loop', unmapped(statements).map(loopStatementAt)]

/** A loop switch keeps every label, braced arm and optional last default. @type {(node: Ast<LoopSwitchRule, ModuleTokenWithMetadata, Out>) => LoopSwitch} */
const loopSwitchAt = node => {
    const [first, , discriminant, , , cases, fallback] = unmapped(node)
    return {
        start: tokenAt(first), discriminant: nodeAt(discriminant),
        cases: unmapped(cases).map(arm => {
            const [labels, block] = unmapped(arm)
            return { labels: unmapped(labels).map(label => nodeAt(unmapped(label)[1])), block: loopBlockOf(unmapped(block)) }
        }),
        default: unmapped(fallback).map(item => loopBlockOf(unmapped(unmapped(item)[2])))[0] ?? null,
    }
}

/** The shared condition/block record for a loop or its normal conditional. @type {(node: Ast<WhileStatement | LoopIfStatement, ModuleTokenWithMetadata, Out>) => While} */
const loopConditionAt = node => {
    const [first, , condition, , blk] = unmapped(node)
    return { start: tokenAt(first), condition: nodeAt(condition), block: loopBlockOf(unmapped(blk)) }
}

/** An alternate has already been rewritten, so chained conditionals cost no host recursion. @type {(node: _Leaf) => LoopBlock} */
const loopElseAt = node => {
    const out = outAt(node)
    assert(out.id === 'loopElse')
    return out.block
}

/** A missing alternate remains distinct from an explicitly empty lexical block. @type {(node: Ast<LoopIfStatement, ModuleTokenWithMetadata, Out>) => LoopIf} */
const loopIfAt = node => {
    const tail = unmapped(unmapped(node)[5])
    return { ...loopConditionAt(node), otherwise: tail.length === 0 ? null : loopElseAt(unmapped(tail[0])[1]) }
}

/** `else if` is a conditional in a normal alternate region. @type {(node: Children<LoopElse, ModuleTokenWithMetadata, Out>) => Meta<Out>} */
const toLoopElse = ([kind, branch]) => {
    /** @type {LoopBlock} */
    const block = kind === 'block' ? loopBlockOf(unmapped(branch)) : ['loop', [['if', loopIfAt(branch)]]]
    return symbol({ id: 'loopElse', block })
}

/**
 * A block's statement, tagged by its keyword: a `const` or a `let`, its
 * record; what begins with a name, an assignment or a call statement,
 * {@link toBodyNameStatement}; a guard, `if ( condition ) block` — the `if`
 * it begins at, its condition, and its block read as a body's is. Loops
 * are read by `toBlockContents`, which also retains final-loop candidates.
 *
 * @type {(node: Children<SimpleStatement, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toStatement = ([kind, branch]) => {
    switch (kind) {
        case 'const': case 'let': { return symbol({ id: 'statement', statement: [kind, constAt(branch)] }) }
        case 'name': { return symbol({ id: 'statement', statement: namedAt(branch) }) }
        default: {
            const [first, , condition, , blk] = unmapped(branch)
            const [block] = blockOf(unmapped(blk))
            return symbol({ id: 'statement', statement: ['if', { start: tokenAt(first), condition: nodeAt(condition), block }] })
        }
    }
}

/**
 * A call statement, `name rest end`: the record of a `const` that binds
 * nothing, `['discard', name]`, its value the value the name begins, read
 * as a value's name branch reads it, {@link continued}, and its beginning
 * the name. Which values it may be — a call alone — is the fold's.
 *
 * @type {(name: ModuleTokenWithMetadata, rest: Ast<ArrowOrRest, ModuleTokenWithMetadata, Out>, end: _EndNode) => Const}
 */
const discarded = (name, rest, end) =>
    ({ start: name, semicolon: ended(end), target: ['discard', name], value: continued({ fixed: [named(name)], rest: null }, ['ref', name], false, rest) })

/** A module's statement before its exports, tagged: a plain loop; a `const` or a `let`, unexported; or what begins with a name, {@link toBodyNameStatement}. @type {(node: Children<ModuleStatement, ModuleTokenWithMetadata, Out>) => Meta<Out>} */
const toModuleStatement = ([kind, branch]) => {
    if (kind === 'while') { return symbol({ id: 'moduleStatement', statement: ['while', loopConditionAt(branch)] }) }
    if (kind === 'name') {
        const named = namedAt(branch)
        return symbol({ id: 'moduleStatement', statement: named[0] === 'assign' ? named : ['const', { declaration: named[1], exported: false }] })
    }
    return symbol({ id: 'moduleStatement', statement: [kind, { declaration: constAt(branch), exported: false }] })
}

/**
 * A body's statement that begins with a name, tagged: the assignment,
 * `name op= value end`, which begins at the name, where an assignment follows it, and
 * otherwise a call statement, {@link discarded}.
 *
 * @type {(node: Children<BodyNameStatement, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toBodyNameStatement = ([name, rest, end]) => {
    const token = tokenAt(unmapped(name)[1])
    const [tag, assigned] = unmapped(rest)
    if (tag !== 'assign') {
        return symbol({ id: 'named', statement: ['const', discarded(token, /** @type {Ast<ArrowOrRest, ModuleTokenWithMetadata, Out>} */ (rest), end)] })
    }
    const [op, v] = unmapped(assigned)
    const [kind, operatorToken] = unmapped(op)
    const operator = assignmentOperators[kind][1]
    return symbol({ id: 'named', statement: ['assign', {
        start: token, semicolon: ended(end), name: token, value: nodeAt(v),
        operator: operator === null ? null : { tag: operator, token: tokenAt(operatorToken) },
    }] })
}

/**
 * A loop block's statement, tagged: a declaration, a conditional, a nested
 * loop, a switch, a loop or function exit, or what begins with a name.
 *
 * @type {(node: Children<LoopStatementRule, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toLoopStatement = ([kind, branch]) => {
    if (kind === 'break' || kind === 'continue') {
        const [keyword, end] = unmapped(branch)
        return symbol({ id: 'loopStatement', statement: [kind, { start: tokenAt(keyword), semicolon: ended(end) }] })
    }
    if (kind === 'return') { return symbol({ id: 'loopStatement', statement: ['return', valueStatementOf(unmapped(branch))] }) }
    if (kind === 'throw') { return symbol({ id: 'loopStatement', statement: ['throw', valueStatementOf(unmapped(branch))] }) }
    if (kind === 'if') { return symbol({ id: 'loopStatement', statement: ['if', loopIfAt(branch)] }) }
    if (kind === 'while') { return symbol({ id: 'loopStatement', statement: ['while', loopConditionAt(branch)] }) }
    if (kind === 'switch') { return symbol({ id: 'loopStatement', statement: ['switch', loopSwitchAt(branch)] }) }
    return symbol({ id: 'loopStatement', statement: kind === 'name' ? namedAt(branch) : [kind, constAt(branch)] })
}

/**
 * The record of a statement that is a keyword and a value — `return`,
 * `throw`, `export default` — from `keyword value end`: it begins at the
 * keyword, and the value's first token is kept for the line the fold asks
 * of it after `return` and `throw`.
 *
 * @type {(node: Children<(typeof terminator)['return'], ModuleTokenWithMetadata, Out>) => ValueStatement}
 */
const valueStatementOf = ([keyword, v, end]) =>
    ({ start: tokenAt(keyword), semicolon: ended(end), first: firstAt(v), value: nodeAt(v) })

/** A member's record as the rewrite returns it, with the property it is where a binding is wanted. @type {(member: Member, target: BindingProperty) => Meta<Out>} */
const memberOf = (member, target) => symbol({ id: 'member', member, target })

/**
 * A member: the token its key begins with, the key by its spelling, and
 * its value, by the branch the key's spelling chose. A bare identifier
 * with no `: value` after it is the shorthand `{ a }`, whose value is the
 * name's own reference, read from the key's token. A computed key's token
 * is the first of the value between the brackets, as an index's is.
 *
 * Beside the member, the property it is in an object pattern: the same
 * key, as an access's — the token, a literal alone in the brackets being
 * the constant an index's is, {@link bracketKey}, or the computed key an
 * index holds — and the target its value is, the shorthand binding the
 * key's own name.
 *
 * @type {(node: Children<MemberRule, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
export const _toMember = ([tag, branch]) => {
    switch (tag) {
        case 'plain': {
            const [id, rest] = unmapped(branch)
            const key = tokenAt(unmapped(id)[1])
            const rounds = unmapped(rest)
            if (rounds.length === 0) {
                return memberOf({ key, spelling: 'shorthand', name: nameOf(key), value: ['ref', key] }, { key, target: ['name', key] })
            }
            const v = unmapped(rounds[0])[1]
            return memberOf({ key, spelling: 'plain', name: nameOf(key), value: nodeAt(v) }, { key, target: valueTargetAt(v) })
        }
        case 'string': {
            const [s, , v] = unmapped(branch)
            const key = tokenAt(s)
            return memberOf({ key, spelling: 'string', name: textOf(key), value: nodeAt(v) }, { key, target: valueTargetAt(v) })
        }
        case 'computed': {
            const [, k, , , v] = unmapped(branch)
            const first = firstAt(k)
            return memberOf({ key: first, spelling: 'computed', node: nodeAt(k), value: nodeAt(v) }, { key: bracketKey(k), target: valueTargetAt(v) })
        }
        default: { throw ['not a member', tag] }
    }
}

/**
 * An entry: the member's record, or a spread of the value at the second
 * position of `... value` — and beside it the property it is in an object
 * pattern, a spread being the rest property `...target`, by its `...`.
 *
 * @type {(node: Children<EntryRule, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toEntry = ([tag, branch]) => {
    if (tag === 'member') { return symbol({ id: 'entry', entry: memberAt(branch), target: memberTargetAt(branch) }) }
    const [dots, v] = unmapped(branch)
    return symbol({ id: 'entry', entry: ['...', nodeAt(v)], target: ['...', tokenAt(dots), valueTargetAt(v)] })
}

/**
 * An import's attribute, when the optional list holds one round: the key at
 * the third position of `with { identifier : string }`, under the
 * alternative its word matched, and the value at the fifth.
 *
 * @type {(node: _AttributeNode) => Import['attribute']}
 */
const attributeOf = node => {
    const rounds = unmapped(node)
    if (rounds.length === 0) { return null }
    const round = unmapped(rounds[0])
    return [tokenAt(unmapped(round[2])[1]), tokenAt(round[4])]
}

/** @type {(node: _Leaf) => ImportBinding} */
const importBindingAt = node => {
    const out = outAt(node)
    assert(out.id === 'importBinding')
    return out.binding
}

/** @type {(node: _Leaf) => List<ImportBinding>} */
const importBindingsAt = node => {
    const out = outAt(node)
    assert(out.id === 'importBindings')
    return out.items
}

const importBindingsOf = listOf(importBindingAt, importBindingsAt)
const importItems = optionalItems(importBindingsAt)

/** @type {(node: Children<typeof importBinding, ModuleTokenWithMetadata, Out>) => Meta<Out>} */
const toImportBinding = ([name, alias]) => {
    const exported = tokenAt(unmapped(name)[1])
    const rounds = unmapped(alias)
    const local = rounds.length === 0 ? exported : tokenAt(unmapped(unmapped(rounds[0])[1])[1])
    return symbol({ id: 'importBinding', binding: { name: nameOf(exported), local } })
}

/** @type {(node: _ListNode) => Meta<Out>} */
const toImportBindings = node => symbol({ id: 'importBindings', items: importBindingsOf(node) })

/** @type {(node: Children<typeof namedImports, ModuleTokenWithMetadata, Out>) => readonly ImportBinding[]} */
const namedBindings = ([, bindings]) => toArray(importItems(bindings))

/**
 * Whether a statement's end, `[ ';' ]`, holds its `;`. Where it does
 * not, JavaScript inserts one at the newline before the next token, at `}`
 * or at the end of input, and refuses a next token on the same line; the
 * fold asks that of the next statement's first token, {@link unterminated}.
 *
 * @type {(node: _EndNode) => boolean}
 */
const ended = node => unmapped(node).length !== 0

/** @type {(node: Children<typeof importStatement, ModuleTokenWithMetadata, Out>) => Meta<Out>} */
const toImport = ([first, clause, , module, attribute, end]) => {
    const [kind, branch] = unmapped(clause)
    /** @type {readonly ImportBinding[]} */
    let bindings
    if (kind === 'named') { bindings = namedBindings(unmapped(branch)) }
    else {
        const [name, more] = unmapped(branch)
        const rounds = unmapped(more)
        bindings = [
            { name: 'default', local: tokenAt(unmapped(name)[1]) },
            ...(rounds.length === 0 ? [] : namedBindings(unmapped(unmapped(rounds[0])[1]))),
        ]
    }
    return symbol({
        id: 'import',
        statement: {
            start: tokenAt(first),
            semicolon: ended(end),
            bindings,
            module: textOf(tokenAt(module)),
            attribute: attributeOf(attribute),
        },
    })
}

/**
 * What a `const` or a fixed parameter after the first binds, from
 * `bindingTarget`'s branch: a name's token, under the alternative its word
 * matched, or the pattern an array or an object literal is,
 * `[ open [ items ] close ]`, read from its list's mapping as a value's
 * is, {@link containerTarget}.
 *
 * @type {(node: Children<BindingTargetRule, ModuleTokenWithMetadata, Out>) => BindingTarget}
 */
const targetOf = ([tag, branch]) => {
    if (tag === 'name') { return ['name', tokenAt(unmapped(branch)[1])] }
    const [open, list] = unmapped(branch)
    return containerTarget(tag, tokenAt(open), list)
}

/** @type {(node: Children<ConstStatement, ModuleTokenWithMetadata, Out>) => Meta<Out>} */
const toConst = ([first, target, , v, end]) =>
    symbol({ id: 'const', statement: { start: tokenAt(first), semicolon: ended(end), target: targetOf(unmapped(target)), value: nodeAt(v) } })

/** @type {(node: _Leaf) => ModuleStatementRecord} */
const moduleStatementAt = node => {
    const out = outAt(node)
    assert(out.id === 'moduleStatement')
    return out.statement
}



/**
 * What a module ends with: the `throw` that stands in place of its exports,
 * read as a block's is; or an export statement — the default, or the
 * exported `const` and the statements after it. An export begins at the
 * `export`, which is where the exported `const` begins too — its own
 * record's `const` is the token after — since the `export` is the token a
 * same-line statement before it is refused at.
 *
 * @type {(node: Children<LastStatement, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toLast = ([kind, branch]) => {
    if (kind === 'throw') {
        return symbol({ id: 'last', statements: null, default: null, thrown: valueStatementOf(unmapped(branch)) })
    }
    const [first, choice] = unmapped(branch)
    const start = tokenAt(first)
    const [which, exported] = unmapped(choice)
    if (which === 'default') {
        const [, v, end] = unmapped(exported)
        return symbol({ id: 'last', statements: null, default: { start, semicolon: ended(end), first: firstAt(v), value: nodeAt(v) }, thrown: null })
    }
    const [declaration, statements, tail] = unmapped(exported)
    const next = unmapped(tail)
    const rest = next.length === 0 ? null : lastAt(next[0])
    return symbol({
        id: 'last',
        statements: concat([
            /** @type {ModuleStatementRecord} */ (['const', { declaration: { ...constAt(declaration), start }, exported: true }]),
            ...unmapped(statements).map(moduleStatementAt),
        ])(rest === null ? null : rest.statements),
        default: rest === null ? null : rest.default,
        thrown: rest === null ? null : rest.thrown,
    })
}

/** @type {(node: Children<typeof module, ModuleTokenWithMetadata, Out>) => Meta<Out>} */
const toModule = ([imports, statements, last]) => {
    const result = lastAt(last)
    return symbol({
        id: 'module',
        module: {
            imports: unmapped(imports).map(importAt),
            statements: [...unmapped(statements).map(moduleStatementAt), ...toArray(result.statements)],
            exported: result.default,
            thrown: result.thrown,
        },
    })
}

/** @type {Mappings<ModuleTokenWithMetadata, Out>} */
const map = mapping

/**
 * An item: the value's node, or a spread of it, the value at the second
 * position of `... value` — and beside it the element it is in an array
 * pattern, the value's target, or the rest element `...target` by its
 * `...`.
 *
 * @type {(node: Children<ItemRule, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toItem = ([tag, branch]) => {
    if (tag === 'value') { return symbol({ id: 'item', item: nodeAt(branch), target: valueTargetAt(branch) }) }
    const [dots, v] = unmapped(branch)
    return symbol({ id: 'item', item: ['...', nodeAt(v)], target: ['...', tokenAt(dots), valueTargetAt(v)] })
}

/** @type {(node: Children<Items<ItemRule>, ModuleTokenWithMetadata, Out>) => Meta<Out>} */
const toValues = node => symbol({ id: 'values', items: valuesOf(node) })

/**
 * An array's elements from `elements`'s branch: an elision, by its comma,
 * {@link Elision} — in the items and the targets alike, a hole in one and
 * a skipped element in the other — before the elements the optional
 * rest's mapping already returned; or an item and the elements after it,
 * read as a list of values is.
 *
 * @type {(node: Children<Elements, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toElements = ([tag, branch]) => {
    if (tag === 'item') {
        const list = unmapped(branch)
        return symbol({ id: 'elements', items: elementsOf(list), targets: elementTargetsOf(list) })
    }
    const [comma, more] = unmapped(branch)
    /** @type {Elision} */
    const elision = ['elision', tokenAt(comma)]
    return symbol({ id: 'elements', items: { first: elision, tail: elementItems(more) }, targets: { first: elision, tail: elementTargets(more) } })
}

/** @type {(node: Children<Items<EntryRule>, ModuleTokenWithMetadata, Out>) => Meta<Out>} */
const toEntries = node => symbol({ id: 'entries', items: entriesOf(node), targets: entryTargetsOf(node) })

/**
 * The parameters after a named list's first, from `parameterNames`'s
 * branch: a fixed parameter — its target, {@link targetOf}, with its
 * default where it has one, {@link parameterWith} — before the parameters
 * its tail's mapping already returned, `target [ '=' value ] [ ',' [
 * parameters ] ]` — so a list of any length costs one step at each of its
 * nodes, as an array's items do — or the rest parameter's token, which
 * ends the list.
 *
 * @type {(node: Children<ParameterNames, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toParameterNames = ([tag, branch]) => {
    if (tag === 'rest') {
        const [, name] = unmapped(branch)
        return symbol({ id: 'parameters', fixed: null, rest: tokenAt(unmapped(name)[1]) })
    }
    const [target, init, more] = unmapped(branch)
    const tail = parametersAfter(more)
    return symbol({ id: 'parameters', fixed: { first: parameterWith(targetOf(unmapped(target)), init), tail: tail.fixed }, rest: tail.rest })
}

/**
 * What follows `(` value `,`, from `parenItems`'s branch, read both ways
 * the `)` may decide: a fixed item — its target as a parameter, with its
 * default where it has one, {@link parameterWith}, and its node as an
 * operand — before the items its tail's mapping already returned, the
 * first token no operand list holds kept, the default's `=` before the
 * tail's; or the rest parameter's token, which ends the list and is that
 * token itself.
 *
 * @type {(node: Children<ParenItems, ModuleTokenWithMetadata, Out>) => Meta<Out>}
 */
const toParenItems = ([tag, branch]) => {
    if (tag === 'rest') {
        const [dots, name] = unmapped(branch)
        return symbol({ ...noParenItems(false), id: 'parenItems', rest: tokenAt(unmapped(name)[1]), refusal: tokenAt(dots) })
    }
    const [v, init, more] = unmapped(branch)
    const tail = parenItemsAfter(more)
    const rounds = unmapped(init)
    return symbol({
        id: 'parenItems',
        fixed: { first: parameterWith(valueTargetAt(v), init), tail: tail.fixed },
        rest: tail.rest,
        operands: { first: nodeAt(v), tail: tail.operands },
        refusal: rounds.length === 0 ? tail.refusal : tokenAt(unmapped(rounds[0])[0]),
        trailing: tail.trailing,
    })
}

/**
 * The rewrite set: a value to its node, a list to its items, a member and
 * each statement to its record, and the module to the records of its
 * statements. Keyed by the rules `./grammar` holds, so that
 * `parser(module, mappings)` yields one symbol carrying the module.
 *
 * @type {RewriteSet<ModuleTokenWithMetadata, Out>}
 */
export const mappings = [
    map(template, toTemplate),
    map(value, toNode),
    map(body, toNode),
    // what a prefix takes is a rule of its own, and its branches are the
    // value's, so the same reader serves it
    map(unary, toNode),
    // a prefix's own operand is a further rule of its own, its branches
    // `unary`'s minus the power, so it takes a reader of its own too
    map(unaryOperand, operandToNode),
    map(item, toItem),
    map(values, toValues),
    map(elements, toElements),
    // a call's arguments are that same list, reached through a rule of its
    // own, so the same reader serves both
    map(callArguments, toValues),
    map(member, _toMember),
    map(entry, toEntry),
    map(entries, toEntries),
    // the parameters after a named list's first, a list of its own so that
    // a list of any length is read in as many steps
    map(parameterNames, toParameterNames),
    // what follows `(` value `,`, an arrow's parameters or a comma's
    // operands, a list of its own as the names are
    map(parenItems, toParenItems),
    map(importBinding, toImportBinding),
    map(importBindings, toImportBindings),
    map(importStatement, toImport),
    map(constStatement, toConst),
    // a `let` is the record a `const` is, under the other keyword
    map(letStatement, toConst),
    map(bodyNameStatement, toBodyNameStatement),
    map(moduleStatement, toModuleStatement),
    map(simpleStatement, toStatement),
    map(blockContents, toBlockContents),
    map(terminator, toEnd),
    map(caseTail, toCaseTail),
    map(afterCase, toAfterCase),
    map(loopStatement, toLoopStatement),
    map(loopElse, toLoopElse),
    map(lastStatement, toLast),
    map(module, toModule),
]

// The tree of a whole module is too deep a type for `tsc` to unroll
// through `parser`'s return type (TS2589); the rule is widened to `Rule`
// here, and `moduleAt` reads the one symbol the match is.
const parseModule = parser(/** @type {Rule} */ (module), mappings)

/**
 * Reads the token list as the syntax tree of a module: the tokenizer's
 * `eof` split off, the grammar matched over the rest, and the tree the
 * mappings built. A failure of the grammar is `unexpected token` at the
 * token it stopped at, or `unexpected end` where the input ran out.
 *
 * Its result has not passed binding, JavaScript early-error or
 * FunctionalScript admission checks, which are the fold's in
 * `../module.f.mjs`; callers compiling source use `parseFromTokens` there.
 *
 * @type {(tokenList: List<ModuleTokenWithMetadata>) => Result<Module, ParseError>}
 */
export const parseSyntax = tokenList => {
    const [tag, stream] = splitEof(toArray(tokenList))
    if (tag === 'error') { return error(stream) }
    const { tokens, eofMetadata } = stream
    const [matched, result] = parseModule(tokens.map(symbolOf))
    if (matched === 'error') {
        // A failure past the last token is the end of input rather than a
        // token the reader can point at.
        const atEnd = result >= tokens.length
        return error({
            message: atEnd ? 'unexpected end' : 'unexpected token',
            metadata: atEnd ? eofMetadata : tokens[result].metadata,
        })
    }
    const [tree] = result
    return ok(moduleAt(tree))
}
