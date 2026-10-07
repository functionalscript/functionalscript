/**
 * The syntax reader: the rewrite set that folds the tree of the grammar
 * in `../grammar` into a module record as the LL(1) backend builds it, and
 * {@link parseSyntax}, the reader over a token stream. What it builds is
 * the syntax tree, `./types.ts`; the fold in `../module.f.mjs` resolves
 * its names and makes the AST of it.
 *
 * ```text
 * DjsToken stream ==the module grammar, one symbol per token==> tree
 *                 ==the rewrite set: a node per value, a record per statement==> module
 * ```
 *
 * A mapping sees one rule's node and no environment, so it builds a node
 * per value — a primitive, a reference by the token that spells it, a
 * container of nodes — and a record per statement, and the names are
 * resolved where the statements are read, after the grammar has matched
 * the whole module. A mapping reports no error: what it cannot say is
 * recorded for the fold to refuse — a parameter list whose head is no
 * name, `{ invalid }`, and a statement's first token and whether a `;`
 * ended it, `Statement`.
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
 * @import { DjsTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { ParseError } from '../types.ts'
 * @import { Block, BlockStatement, Const, Entry, Import, ImportBinding, Item, Member, Module, ModuleConst, Node, Out, ParameterBinding, ParameterList, ValueStatement } from './types.ts'
 * @import { ArrowOrRest, Block as BlockRule, Body, Entry as EntryRule, Group, Item as ItemRule, Items, LastStatement, Member as MemberRule, ParameterNames, Parenthesized, Statement, Unary, UnaryOperand, Value } from '../grammar/types.ts'
 * @import { namedImports, primitive, terminator } from '../grammar/module.f.mjs'
 * @import { _AccessNode, _AttributeNode, _CallBranch, _CircuitNode, _ConditionalNode, _EndNode, _NameNode, _KeyBranch, _Leaf, _ListNode, _OptionalList, _ParameterNode, _PowTailNode, _TailRound, _TokenStream } from './private.ts'
 */

import { error, ok } from '../../../types/result/module.f.mjs'
import { concat, toArray } from '../../../types/list/module.f.mjs'
import { assert, assertNotNullish } from '../../../asserts/module.f.mjs'
import { literalWords } from '../../../js/keywords/module.f.mjs'
import { symbolAt, unmapped } from '../../../ebnf/ast/module.f.mjs'
import { mapping, parser } from '../../../ebnf/ll1/module.f.mjs'
import {
    binaryOpTag, body, callArguments, constStatement, djsModule, eagerTail, importBinding, importBindings,
    importStatement, item, lastStatement, entries, entry, member, parameterNames, statement, symbolOf, unary, unaryOperand, value, values,
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
 * @type {(tokens: readonly DjsTokenWithMetadata[]) => Result<_TokenStream, ParseError>}
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
 * @type {(node: _Leaf) => DjsTokenWithMetadata}
 */
const tokenAt = node => {
    const { meta } = symbolAt(node)
    assert('token' in meta)
    return meta
}

/**
 * What a mapping returned at a position: an output symbol.
 *
 * @type {(node: _Leaf) => Out}
 */
const outAt = node => {
    const { meta } = symbolAt(node)
    assert('id' in meta)
    return meta
}

/** The node at a value's position, whether or not a `(` opened it. @type {(node: _Leaf) => Node} */
const nodeAt = node => {
    const out = outAt(node)
    assert(out.id === 'value' || out.id === 'paren')
    return out.node
}

/** @type {(node: _Leaf) => List<ParameterBinding>} */
const parametersAt = node => {
    const out = outAt(node)
    assert(out.id === 'parameters')
    return out.items
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

/** @type {(node: _Leaf) => BlockStatement} */
const statementAt = node => {
    const out = outAt(node)
    assert(out.id === 'statement')
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
 * @type {(t: DjsTokenWithMetadata) => string}
 */
export const nameOf = ({ token }) => {
    if (token.kind === 'id') { return token.value }
    assert(literalWordSet.has(token.kind), token.kind)
    return token.kind
}

/** The text a string token spells. @type {(t: DjsTokenWithMetadata) => string} */
export const textOf = ({ token }) => {
    assert(token.kind === 'string')
    return token.value
}

/**
 * A primitive is what its branch spells, read off the one token the
 * branch holds: the branch is the token's kind, so the switch is over the
 * grammar's own list of value kinds.
 *
 * @type {(node: Children<typeof primitive, DjsTokenWithMetadata, Out>) => Primitive}
 */
const primitiveOf = ([tag, leaf]) => {
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
    }
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

/** The items an array's optional list holds. */
const valueItems = optionalItems(valuesAt)

/** The entries an object's optional list holds. */
const entryItems = optionalItems(entriesAt)

/** The items of a list of values, its tail already mapped. */
const valuesOf = listOf(itemAt, valuesAt)

/** The names a parameter list's optional tail holds, `[ ',' [ names ] ]` after the first. */
const parameterItems = optionalItems(parametersAt)

/** The token of a named parameter after the first: under the alternative its word matched. @type {(node: _Leaf) => DjsTokenWithMetadata} */
const nameTokenAt = node => tokenAt(unmapped(/** @type {_NameNode} */ (node))[1])

/** The names of a parameter list after the first, its tail already mapped. */
const parametersOf = listOf(node => ({ name: nameTokenAt(node), rest: false }), parametersAt)

/** The entries of a list of entries, its tail already mapped. */
const entriesOf = listOf(entryAt, entriesAt)

/** @type {(out: Out) => Meta<Out>} */
const symbol = out => ({ symbol: 0, meta: out })

/**
 * The token an access names its key by: `.name`'s identifier, or `[key]`'s
 * constant — at the second position of either branch, under the
 * identifier's or the constant's own alternative.
 *
 * @type {(branch: _KeyBranch) => DjsTokenWithMetadata}
 */
const accessKey = branch => tokenAt(unmapped(unmapped(branch)[1])[1])

/**
 * A function's parameter list where it begins with no value: the rest
 * parameter, its token the identifier at the second position of
 * `... id`, under the alternative its word matched, as a `const`'s
 * name is — or the empty list, which has no token, and the fold has no
 * word to bind, so a body under it names nothing.
 *
 * @type {(node: _ParameterNode) => ParameterList}
 */
const parameterOf = node => {
    const rounds = unmapped(node)
    return rounds.length === 0 ? [] : [{ name: tokenAt(unmapped(unmapped(rounds[0])[1])[1]), rest: true }]
}

/**
 * A named parameter list from the value at its head and the names after
 * it: the head is a parameter where it is a plain name — a reference, and
 * not one a `(` opened again, `((a)) => 1` being a syntax error in
 * JavaScript — and otherwise the list is malformed, anchored at the `(`
 * that opened it for the fold to refuse.
 *
 * @type {(open: DjsTokenWithMetadata, head: _Leaf, more: List<ParameterBinding>) => ParameterList}
 */
const namedList = (open, head, more) => {
    const out = outAt(head)
    return out.id === 'value' && out.node[0] === 'ref' ? [{ name: out.node[1], rest: false }, ...toArray(more)] : { invalid: open }
}

/**
 * One step applied to the node before it: a property access by the token
 * its key is read from, or a call by its arguments — the optional list at
 * the second position of `( [ items(value) ] )`, read as an array's items
 * are.
 *
 * What a step applies to is everything written before it, which is what
 * folding them in order says: `a.b(1)[0]` is the index of the call of the
 * access, and `f(1)(2)` is the call of the call. A group is no boundary
 * here — the step reads the value inside it, so `(a.b)(c)` is the node
 * `a.b(c)` is.
 *
 * @type {(base: Node, round: _AccessNode) => Node}
 */
const accessed = (base, round) => {
    const [tag, branch] = unmapped(round)
    if (tag !== 'call') { return ['.', base, accessKey(/** @type {_KeyBranch} */(branch))] }
    const call = unmapped(/** @type {_CallBranch} */(branch))
    return ['()', base, toArray(valueItems(call[1]))]
}

/**
 * A value's own part and the steps written after it, each applied to
 * everything before it: the node the last of them leaves.
 *
 * @type {(base: Node, accesses: readonly _AccessNode[]) => Node}
 */
const steps = (base, accesses) => accesses.reduce(accessed, base)

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
    const [opTag] = unmapped(opChoice)
    const right = applyLayers(nodeAt(v), lowerTails)
    // every round's operator is a rule the grammar made from the same
    // records, so a name the map lacks is the grammar's bug, not the input's
    const tag = assertNotNullish(binaryOpTag[opTag], ['binary operator without a tag', opTag])
    return [tag, left, right]
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
 * @type {(node: Exclude<Children<Unary, DjsTokenWithMetadata, Out> | Children<UnaryOperand, DjsTokenWithMetadata, Out> | Children<Value, DjsTokenWithMetadata, Out> | Children<Body, DjsTokenWithMetadata, Out>, readonly ['paren' | 'group' | 'block' | 'neg' | 'bitnot' | 'not' | 'typeof' | 'name', unknown]>) => Node}
 */
const baseOf = ([tag, branch]) => {
    switch (tag) {
        case 'primitive': {
            const x = unmapped(branch)[0]
            const p = unmapped(x)[0]
            return ['primitive', primitiveOf(unmapped(p))]
        }
        case 'ref': {
            const x = unmapped(branch)[0]
            const p = unmapped(x)[0]
            return ['ref', tokenAt(unmapped(p)[1])]
        }
        case 'array': {
            const x = unmapped(branch)[0]
            const a = unmapped(x)[0]
            return ['array', toArray(valueItems(unmapped(a)[1]))]
        }
        case 'object': {
            const x = unmapped(branch)[0]
            const o = unmapped(x)[0]
            return ['object', toArray(entryItems(unmapped(o)[1]))]
        }
    }
}

/**
 * The token a value begins with, `first` of what its mapping returned,
 * whether or not a `(` opened it: what a `return` asks for its line.
 *
 * @type {(node: _Leaf) => DjsTokenWithMetadata}
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
 * @type {(tag: 'primitive' | 'ref' | 'array' | 'object', base: _Leaf) => DjsTokenWithMetadata}
 */
const baseFirst = (tag, base) => tokenAt(/** @type {_Leaf} */ (unmapped(base)[tag === 'array' || tag === 'object' ? 0 : 1]))

/**
 * A function's parameter list against its `=>`: the list, or the `=>`
 * where a newline precedes it, which JavaScript forbids — `a\n=> 1` is a
 * syntax error there — for the fold to refuse at the `=>`. A list already
 * malformed keeps its own refusal, which comes first in the source.
 *
 * @type {(list: ParameterList, arrow: DjsTokenWithMetadata) => ParameterList}
 */
const arrowed = (list, arrow) => 'invalid' in list || !arrow.newline ? list : { arrow }

/**
 * What follows a name or a `( value )`, `arrowOrRest`: the function whose
 * one parameter it is, by the `=>` and the body of `=> body`, `list`
 * being that parameter — or the value with the steps at the first
 * position of `access* powTail tail`, the power at the second and the
 * binary layers after them applied, exactly as {@link toNode} applies a
 * value's own.
 *
 * @type {(list: ParameterList, base: Node, node: Ast<ArrowOrRest, DjsTokenWithMetadata, Out>) => Node}
 */
const continued = (list, base, node) => {
    const [tag, branch] = unmapped(node)
    if (tag === 'func') {
        const [arrow, b] = unmapped(branch)
        return ['=>', arrowed(list, tokenAt(arrow)), nodeAt(b)]
    }
    const [accesses, powTail, ...tailLists] = unmapped(branch)
    return applyTail(withPow(steps(base, unmapped(accesses)), powTail), tailLists)
}

/**
 * What a `(` opened, at the second position of `( (func | value afterValue)`:
 * a function whose list begins with no value, by that list at the first
 * position of `[ ... id ] ) => body`, its `=>` at the third and its body
 * at the fourth — or a value and what follows it: `,`, the names after the
 * value, the `=>` and the body at the fifth position of
 * `, [ names ] ) => body`, the value heading a named list; or `)` and then
 * {@link continued}, the value the one parameter or a group. Each `=>` is
 * checked against its line, {@link arrowed}.
 *
 * A group is no node of its own: `(x)` is whatever `x` is, and the steps
 * after the `)` apply to that same node, so nothing downstream can tell a
 * group was written. That is what JavaScript means by parentheses — they
 * keep even a property reference, so `(a.b)(c)` passes `a` as `a.b(c)`
 * does — and it leaves a group no canonical form to choose. The one
 * reader that has to know is {@link namedList}, and the `paren` id of
 * this rule's own output is what tells it.
 *
 * @type {(open: DjsTokenWithMetadata, node: Children<Parenthesized, DjsTokenWithMetadata, Out>) => Node}
 */
const parenNode = (open, [tag, branch]) => {
    if (tag === 'func') {
        const [p, , arrow, b] = unmapped(branch)
        return ['=>', arrowed(parameterOf(p), tokenAt(arrow)), nodeAt(b)]
    }
    const [v, after] = unmapped(branch)
    const [kind, rest] = unmapped(after)
    if (kind === 'list') {
        const [, names, , arrow, b] = unmapped(rest)
        return ['=>', arrowed(namedList(open, v, parameterItems(names)), tokenAt(arrow)), nodeAt(b)]
    }
    const [, next] = unmapped(rest)
    return continued(namedList(open, v, null), nodeAt(v), next)
}

/**
 * A group's node, from `value ) access* '**' unary`: the value at the
 * first position, the steps after the `)` at the third applied to it, and
 * the power at the fourth raised over that.
 *
 * @type {(node: Ast<Group, DjsTokenWithMetadata, Out>) => Node}
 */
const groupNode = node => {
    const [v, , accesses, powTail] = unmapped(node)
    return withPow(steps(nodeAt(v), unmapped(accesses)), powTail)
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
 * @type {(node: Children<Unary, DjsTokenWithMetadata, Out> | Children<Value, DjsTokenWithMetadata, Out> | Children<Body, DjsTokenWithMetadata, Out>) => Meta<Out>}
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
        return symbol({ id: 'value', node: continued([{ name: token, rest: false }], ['ref', token], after), first: token })
    }
    if (node[0] === 'group') {
        const [open, g] = unmapped(node[1])
        return symbol({ id: 'value', node: groupNode(g), first: tokenAt(open) })
    }
    if (node[0] === 'neg' || node[0] === 'bitnot' || node[0] === 'not' || node[0] === 'typeof') {
        const [op, v, ...tailLists] = unmapped(node[1])
        return symbol({ id: 'value', node: applyTail([prefixOps[node[0]], nodeAt(v)], tailLists), first: tokenAt(op) })
    }
    if (node[0] === 'block') {
        const [block, first] = blockOf(unmapped(node[1]))
        return symbol({ id: 'value', node: block, first })
    }
    const x = unmapped(node[1])[0]
    const [base, accesses] = unmapped(x)
    const [, powTail, ...tailLists] = unmapped(node[1])
    const withSteps = steps(baseOf(node), unmapped(accesses))
    return symbol({ id: 'value', node: applyTail(withPow(withSteps, powTail), tailLists), first: baseFirst(node[0], base) })
}

/**
 * A prefix's own operand: {@link unaryOperand}'s branches, read the same
 * way {@link toNode} reads {@link unary}'s but for the power and the
 * binary layers above it, neither of which this rule's grammar admits — a
 * further prefix, recursing through this same reader by way of
 * {@link nodeAt}, {@link unaryOperand} mapped here exactly as {@link
 * unary} is by `toNode`; a group, whose own steps apply with no power past
 * the `)`; or the base itself, through {@link baseOf}, with only the
 * accesses after it applied.
 *
 * @type {(node: Children<UnaryOperand, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const operandToNode = node => {
    if (node[0] === 'neg' || node[0] === 'bitnot' || node[0] === 'not' || node[0] === 'typeof') {
        const [op, v] = unmapped(node[1])
        return symbol({ id: 'value', node: [prefixOps[node[0]], nodeAt(v)], first: tokenAt(op) })
    }
    if (node[0] === 'group') {
        const [open, g] = unmapped(node[1])
        const [v, , accesses] = unmapped(g)
        return symbol({ id: 'value', node: steps(nodeAt(v), unmapped(accesses)), first: tokenAt(open) })
    }
    const x = unmapped(node[1])[0]
    const [base, accesses] = unmapped(x)
    return symbol({ id: 'value', node: steps(baseOf(node), unmapped(accesses)), first: baseFirst(node[0], base) })
}

/**
 * A block from its children, `{`, the statements, the terminator and `}`:
 * its ordered statements, `const`s and guards, then the `return` or `throw`
 * that ends it, tagged by its keyword — and the `{` it begins at. A
 * function's body and a guard's block are read the same way.
 *
 * @type {(node: Children<BlockRule, DjsTokenWithMetadata, Out>) => readonly [Block, DjsTokenWithMetadata]}
 */
const blockOf = ([open, statements, term]) => {
    const [kind, branch] = unmapped(term)
    return [['block', [...unmapped(statements).map(statementAt), [kind, valueStatementOf(unmapped(branch))]]], tokenAt(open)]
}

/**
 * A block's statement, tagged by its keyword: a `const`, its record; or a
 * guard, `if ( condition ) block` — the `if` it begins at, its condition,
 * and its block read as a body's is.
 *
 * @type {(node: Children<Statement, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const toStatement = ([kind, branch]) => {
    if (kind === 'const') { return symbol({ id: 'statement', statement: ['const', constAt(branch)] }) }
    const [first, , condition, , blk] = unmapped(branch)
    const [block] = blockOf(unmapped(blk))
    return symbol({ id: 'statement', statement: ['if', { start: tokenAt(first), condition: nodeAt(condition), block }] })
}

/**
 * The record of a statement that is a keyword and a value — `return`,
 * `throw`, `export default` — from `keyword value end`: it begins at the
 * keyword, and the value's first token is kept for the line the fold asks
 * of it after `return` and `throw`.
 *
 * @type {(node: Children<(typeof terminator)['return'], DjsTokenWithMetadata, Out>) => ValueStatement}
 */
const valueStatementOf = ([keyword, v, end]) =>
    ({ start: tokenAt(keyword), semicolon: ended(end), first: firstAt(v), value: nodeAt(v) })

/**
 * A member: the token its key is read from, the name it spells, the key's
 * spelling, and its value, by the branch the key's spelling chose. A bare
 * identifier with no `: value` after it is the shorthand `{ a }`, whose
 * value is the name's own reference, read from the key's token.
 *
 * @type {(node: Children<MemberRule, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const toMember = ([tag, branch]) => {
    /** @type {(key: DjsTokenWithMetadata, name: string, spelling: Member['spelling'], value: Node) => Meta<Out>} */
    const member = (key, name, spelling, value) => symbol({ id: 'member', member: { key, name, spelling, value } })
    switch (tag) {
        case 'plain': {
            const [id, rest] = unmapped(branch)
            const key = tokenAt(unmapped(id)[1])
            const rounds = unmapped(rest)
            return rounds.length === 0
                ? member(key, nameOf(key), 'shorthand', ['ref', key])
                : member(key, nameOf(key), 'plain', nodeAt(unmapped(rounds[0])[1]))
        }
        case 'string': {
            const [s, , v] = unmapped(branch)
            const key = tokenAt(s)
            return member(key, textOf(key), 'string', nodeAt(v))
        }
        case 'computed': {
            const [, s, , , v] = unmapped(branch)
            const key = tokenAt(s)
            return member(key, textOf(key), 'computed', nodeAt(v))
        }
    }
}

/**
 * An entry: the member's record, or a spread of the value at the second
 * position of `... value`.
 *
 * @type {(node: Children<EntryRule, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const toEntry = ([tag, branch]) => symbol({
    id: 'entry',
    entry: tag === 'member' ? memberAt(branch) : ['...', nodeAt(unmapped(branch)[1])],
})

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

/** @type {(node: Children<typeof importBinding, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toImportBinding = ([name, alias]) => {
    const exported = tokenAt(unmapped(name)[1])
    const rounds = unmapped(alias)
    const local = rounds.length === 0 ? exported : tokenAt(unmapped(unmapped(rounds[0])[1])[1])
    return symbol({ id: 'importBinding', binding: { name: nameOf(exported), local } })
}

/** @type {(node: _ListNode) => Meta<Out>} */
const toImportBindings = node => symbol({ id: 'importBindings', items: importBindingsOf(node) })

/** @type {(node: Children<typeof namedImports, DjsTokenWithMetadata, Out>) => readonly ImportBinding[]} */
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

/** @type {(node: Children<typeof importStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
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

/** @type {(node: Children<typeof constStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toConst = ([first, name, , v, end]) =>
    symbol({ id: 'const', statement: { start: tokenAt(first), semicolon: ended(end), name: tokenAt(unmapped(name)[1]), value: nodeAt(v) } })

/** @type {(node: _Leaf) => ModuleConst} */
const ordinaryConst = node => ({ declaration: constAt(node), exported: false })

/**
 * What a module ends with: the `throw` that stands in place of its exports,
 * read as a block's is; or an export statement — the default, or the
 * exported `const` and the statements after it. An export begins at the
 * `export`, which is where the exported `const` begins too — its own
 * record's `const` is the token after — since the `export` is the token a
 * same-line statement before it is refused at.
 *
 * @type {(node: Children<LastStatement, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const toLast = ([kind, branch]) => {
    if (kind === 'throw') {
        return symbol({ id: 'last', consts: null, default: null, thrown: valueStatementOf(unmapped(branch)) })
    }
    const [first, choice] = unmapped(branch)
    const start = tokenAt(first)
    const [which, exported] = unmapped(choice)
    if (which === 'default') {
        const [, v, end] = unmapped(exported)
        return symbol({ id: 'last', consts: null, default: { start, semicolon: ended(end), first: firstAt(v), value: nodeAt(v) }, thrown: null })
    }
    const [declaration, consts, tail] = unmapped(exported)
    const next = unmapped(tail)
    const rest = next.length === 0 ? null : lastAt(next[0])
    return symbol({
        id: 'last',
        consts: concat([
            { declaration: { ...constAt(declaration), start }, exported: true },
            ...unmapped(consts).map(ordinaryConst),
        ])(rest === null ? null : rest.consts),
        default: rest === null ? null : rest.default,
        thrown: rest === null ? null : rest.thrown,
    })
}

/** @type {(node: Children<typeof djsModule, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toModule = ([imports, consts, last]) => {
    const result = lastAt(last)
    return symbol({
        id: 'module',
        module: {
            imports: unmapped(imports).map(importAt),
            consts: [...unmapped(consts).map(ordinaryConst), ...toArray(result.consts)],
            exported: result.default,
            thrown: result.thrown,
        },
    })
}

/** @type {Mappings<DjsTokenWithMetadata, Out>} */
const map = mapping

/**
 * An item: the value's node, or a spread of it, the value at the second
 * position of `... value`.
 *
 * @type {(node: Children<ItemRule, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const toItem = ([tag, branch]) => symbol({
    id: 'item',
    item: tag === 'value' ? nodeAt(branch) : ['...', nodeAt(unmapped(branch)[1])],
})

/** @type {(node: Children<Items<ItemRule>, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toValues = node => symbol({ id: 'values', items: valuesOf(node) })

/** @type {(node: Children<Items<EntryRule>, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toEntries = node => symbol({ id: 'entries', items: entriesOf(node) })

/** @type {(node: Children<ParameterNames, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toParameterNames = ([tag, branch]) => {
    if (tag === 'fixed') { return symbol({ id: 'parameters', items: parametersOf(unmapped(branch)) }) }
    const [, name] = unmapped(branch)
    return symbol({ id: 'parameters', items: [{ name: tokenAt(unmapped(name)[1]), rest: true }] })
}

/**
 * The rewrite set: a value to its node, a list to its items, a member and
 * each statement to its record, and the module to the records of its
 * statements. Keyed by the rules `./grammar` holds, so that
 * `parser(djsModule, mappings)` yields one symbol carrying the module.
 *
 * @type {RewriteSet<DjsTokenWithMetadata, Out>}
 */
export const mappings = [
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
    // a call's arguments are that same list, reached through a rule of its
    // own, so the same reader serves both
    map(callArguments, toValues),
    map(member, toMember),
    map(entry, toEntry),
    map(entries, toEntries),
    // the names after a named list's first, a list of its own so that a
    // list of any length is read in as many steps
    map(parameterNames, toParameterNames),
    map(importBinding, toImportBinding),
    map(importBindings, toImportBindings),
    map(importStatement, toImport),
    map(constStatement, toConst),
    map(statement, toStatement),
    map(lastStatement, toLast),
    map(djsModule, toModule),
]

// The tree of a whole module is too deep a type for `tsc` to unroll
// through `parser`'s return type (TS2589); the rule is widened to `Rule`
// here, and `moduleAt` reads the one symbol the match is.
const parseModule = parser(/** @type {Rule} */ (djsModule), mappings)

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
 * @type {(tokenList: List<DjsTokenWithMetadata>) => Result<Module, ParseError>}
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
