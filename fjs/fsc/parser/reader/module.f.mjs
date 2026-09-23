/**
 * The DJS syntax reader: the rewrite set that folds the tree of the grammar
 * in `../grammar` into a module of nodes as the LL(1) backend builds it,
 * and {@link readFromTokens}, the reader over a token stream — the first
 * two arrows of the parser, the third being `../module.f.mjs`'s fold:
 *
 * ```text
 * DjsToken stream ==the module grammar, one symbol per token==> tree
 *                 ==the rewrite set: a node per value, a record per statement==> module
 * ```
 *
 * A mapping sees one rule's node and no environment, so it builds a node
 * per value — a primitive, a reference by the token that spells it, a
 * container of nodes — and a record per statement. A word is kept as
 * spelled and judged by nothing here — a property key's and a module
 * specifier's are taken from their tokens, a name stays its token — and
 * what a name means is the fold's, once the grammar has matched the whole
 * module. A match that fails builds no module, so a malformed suffix is
 * found before any name is resolved. `../README.md` holds the argument.
 *
 * Every walk is a mapping of one node: the machine's own stack is on the
 * heap, and a list's mapping puts one item before the list its tail's
 * mapping returned, so nesting depth and width stay the input's.
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
 * @import { BinaryTag } from '../../ast/types.ts'
 * @import { ParseError } from '../types.ts'
 * @import { Const, Container, Entry, Import, Module, ModuleConst, Node, Out, Parameters } from './types.ts'
 * @import { AfterName, Body, Group, GroupValue, Items, Member, Named, NamedMore, ParameterNames, Parenthesized, Unary, UnaryOperand, Value } from '../grammar/types.ts'
 * @import { key, primitive } from '../grammar/module.f.mjs'
 * @import { _AccessNode, _AfterNameNode, _AttributeNode, _BaseNode, _CallBranch, _CircuitNode, _ConditionalNode, _KeyBranch, _Leaf, _ListNode, _NameNode, _OptionalList, _PowTailNode, _TailRound, _TokenStream } from './private.ts'
 */

import { error, ok } from '../../../types/result/module.f.mjs'
import { concat, toArray } from '../../../types/list/module.f.mjs'
import { assert } from '../../../asserts/module.f.mjs'
import { literalWords } from '../../../js/keywords/module.f.mjs'
import { symbolAt, unmapped } from '../../../ebnf/ast/module.f.mjs'
import { mapping, parser } from '../../../ebnf/ll1/module.f.mjs'
import {
    body, callArguments, constStatement, djsModule, eagerTail, exportStatement, groupValue, importStatement, member, members,
    parameterNames, symbolOf, tail, unary, unaryOperand, value, values,
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

/** @type {(node: _Leaf) => Node} */
const nodeAt = node => {
    const out = outAt(node)
    assert(out.id === 'value')
    return out.node
}

/** @type {(node: _Leaf) => List<Node>} */
const valuesAt = node => {
    const out = outAt(node)
    assert(out.id === 'values')
    return out.items
}

/** @type {(node: _Leaf) => List<DjsTokenWithMetadata>} */
const namesAt = node => {
    const out = outAt(node)
    assert(out.id === 'names')
    return out.items
}

/** @type {(node: _Leaf) => Entry} */
const memberAt = node => {
    const out = outAt(node)
    assert(out.id === 'member')
    return out.member
}

/** @type {(node: _Leaf) => List<Entry>} */
const membersAt = node => {
    const out = outAt(node)
    assert(out.id === 'members')
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

/** @type {(node: _Leaf) => Extract<Out, { readonly id: 'export' }>} */
const exportAt = node => {
    const out = outAt(node)
    assert(out.id === 'export')
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
 * ECMAScript `IdentifierName`, which admits every reserved word — and the
 * fold then refuses them where a *binding* is wanted, as it refuses every
 * other keyword.
 *
 * @type {ReadonlySet<string>}
 */
const literalWordSet = new Set(/** @type {readonly string[]} */(literalWords))

/**
 * The word a name token spells. A framing keyword is an identifier too,
 * arriving as the same `id` token; each of the six words that denote a
 * value is a token kind of its own, and *is* its own word. Exported for
 * the fold, which reads the words this reader only carries — linkage, not
 * API, which the `_` says as it does for `_tokenKindNames` in
 * `../grammar`.
 *
 * @type {(t: DjsTokenWithMetadata) => string}
 */
export const _nameOf = ({ token }) => {
    if (token.kind === 'id') { return token.value }
    assert(literalWordSet.has(token.kind), token.kind)
    return token.kind
}

/** The text a string token holds. Exported for the fold, as {@link _nameOf} is. @type {(t: DjsTokenWithMetadata) => string} */
export const _textOf = ({ token }) => {
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
            return parseFloat(token.value)
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
 * The items of a list node, `item [ ',' t [ items ] ]`: the item, then
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
        // no round, or the one holding the comma, its trivia and the optional rest
        const tail = rounds.length === 0 ? null : rest(unmapped(rounds[0])[2])
        return { first: itemAt(item), tail }
    }
}

/** The items an array's optional list holds. */
const valueItems = optionalItems(valuesAt)

/** The members an object's optional list holds. */
const memberItems = optionalItems(membersAt)

/** The names a parameter list's optional rest holds, after its first. */
const nameItems = optionalItems(namesAt)

/** The items of a list of values, its tail already mapped. */
const valuesOf = listOf(nodeAt, valuesAt)

/** The members of a list of members, its tail already mapped. */
const membersOf = listOf(memberAt, membersAt)

/**
 * The token a name stands as, under the alternative its word matched: an
 * `identifier` or an `identifierName` is a choice of one symbol per word,
 * so the token is one level in, as a `const`'s name is read.
 *
 * @type {(node: _NameNode) => DjsTokenWithMetadata}
 */
const nameAt = node => tokenAt(unmapped(node)[1])

/** The names of a parameter list after its first, its tail already mapped: each item a name and its trivia. @type {(item: _Leaf) => DjsTokenWithMetadata} */
const parameterAt = item => nameAt(/** @type {_NameNode} */ (unmapped(item)[0]))

/** The names of a list of names, its tail already mapped. */
const namesOf = listOf(parameterAt, namesAt)

/** @type {(out: Out) => Meta<Out>} */
const symbol = out => ({ symbol: 0, meta: out })

/**
 * The token an access names its key by: `.name`'s identifier, or `[key]`'s
 * constant — at the third position of either branch, under the identifier's
 * or the constant's own alternative.
 *
 * @type {(branch: _KeyBranch) => DjsTokenWithMetadata}
 */
const accessKey = branch => tokenAt(unmapped(unmapped(branch)[2])[1])

/**
 * One step applied to the node before it: a property access by the token
 * its key is read from, or a call by its arguments — the optional list at
 * the third position of `( t [ items(value) ] ) t`, read as an array's
 * items are.
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
    return ['()', base, toArray(valueItems(call[2]))]
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
 * group is raised to a power: the operand at the third position of `'**' t
 * unary`, under the one round the option holds.
 *
 * @type {(base: Node, powTail: _PowTailNode) => Node}
 */
const withPow = (base, powTail) => {
    const rounds = unmapped(powTail)
    if (rounds.length === 0) { return base }
    const [, , v] = unmapped(rounds[0])
    return ['**', base, nodeAt(v)]
}

/**
 * Every binary layer's own tag, read to its operator, in one flat map:
 * `multiplicativeOp` through `nullishOp` (`../grammar/module.f.mjs`) each
 * key their own rounds by a name none of the other ten use, so one map
 * serves a round from any layer — no per-layer reader, and so no branch for
 * a tag no round can carry: a plain lookup has no branch to leave
 * unreachable where a `switch`'s `default` would. `**` is not here: it is
 * `powTail`'s, no layer's round, read by {@link withPow}.
 *
 * @type {{ readonly [tag: string]: Exclude<BinaryTag, '**'> }}
 */
const binaryOpTag = {
    mul: '*', div: '/', mod: '%',
    add: '+', sub: '-',
    left: '<<', right: '>>', unsigned: '>>>',
    lt: '<', le: '<=', gt: '>', ge: '>=',
    eq: '===', ne: '!==',
    and: '&',
    xor: '^',
    or: '|',
    logicalAnd: '&&', logicalOr: '||', nullish: '??',
}

/**
 * One binary layer's rounds folded onto `base`, left-associative: each
 * round is `op t unary tail*`, its own trailing tail lists — one per layer
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
    const [opChoice, , v, ...lowerTails] = unmapped(round)
    const [opTag] = unmapped(opChoice)
    const right = applyLayers(nodeAt(v), lowerTails)
    return [binaryOpTag[opTag], left, right]
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
 * The conditional folded onto `base`: nothing, or `? t value : t value`,
 * the arms at the third and sixth positions of the one round the option
 * holds — each a whole value already mapped, so a nested conditional in
 * either arm is a node here and never a call, however deep the source
 * nests them.
 *
 * @type {(base: Node, conditional: _ConditionalNode) => Node}
 */
const applyConditional = (base, conditional) => {
    const rounds = unmapped(conditional)
    if (rounds.length === 0) { return base }
    const [, , t, , , e] = unmapped(rounds[0])
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
 * by its token, and a container of the items its list returned — `[ open t
 * [ items ] close t ]`, the list at the third position, under the
 * `[thing, accesses]` pair every one of these branches opens with, at the
 * first position of the branch itself. What a `(` opens, a block, a
 * negation and a bitwise not are not here: each of those takes no access of
 * its own, so its node is made whole in {@link toNode}, and a group's value
 * is reached through {@link parenNode}.
 *
 * Takes the whole node, tag and branch together, rather than a pre-peeled
 * `x`: the branch narrows by `tag` only inside the discriminated union
 * `Children<Unary | UnaryOperand | Value | Body, …>` still is at this
 * position, which is what lets the second `unmapped` below see a precise
 * shape instead of `unknown`. `UnaryOperand`'s own four leaves are wrapped
 * one tuple deep for exactly this reason — see its own comment in
 * `../grammar/module.f.mjs` — so the same reads serve both rules.
 *
 * @type {(node: Exclude<Children<Unary, DjsTokenWithMetadata, Out> | Children<UnaryOperand, DjsTokenWithMetadata, Out> | Children<Value, DjsTokenWithMetadata, Out> | Children<Body, DjsTokenWithMetadata, Out>, readonly ['paren' | 'group' | 'block' | 'neg' | 'bitnot' | 'name', unknown]>) => Node}
 */
const baseOf = ([tag, branch]) => {
    switch (tag) {
        case 'primitive': {
            const x = unmapped(branch)[0]
            const p = unmapped(x)[0]
            return ['primitive', primitiveOf(unmapped(unmapped(p)[0]))]
        }
        case 'ref': {
            const x = unmapped(branch)[0]
            const p = unmapped(x)[0]
            return ['ref', tokenAt(unmapped(unmapped(p)[0])[1])]
        }
        case 'array': {
            const x = unmapped(branch)[0]
            const a = unmapped(x)[0]
            return ['array', toArray(valueItems(unmapped(a)[2]))]
        }
        case 'object': {
            const x = unmapped(branch)[0]
            const o = unmapped(x)[0]
            return ['object', toArray(memberItems(unmapped(o)[2]))]
        }
    }
}

/**
 * What follows a name, {@link afterName} in `../grammar/module.f.mjs`: `=>`
 * and a body, at the first and third positions of `=> t body` — the
 * function of the parameter list `parameters` makes of the arrow's token —
 * or the rest of a value over `value`, `n access* powTail tail`, the steps
 * at the second position and the power at the third applied to it and the
 * binary layers above it, {@link applyTail}.
 *
 * The arrow's token goes to `parameters` because what the list is depends
 * on what the name was followed by: a bare name and `(a)` make the one
 * parameter, and a group that is more than a name makes the list the fold
 * refuses, anchored at that arrow.
 *
 * @type {(value: Node, parameters: (arrow: DjsTokenWithMetadata) => Parameters, node: _AfterNameNode) => Node}
 */
const afterNamed = (value, parameters, node) => {
    const [tag, branch] = unmapped(node)
    if (tag === 'arrow') {
        const [arrow, , b] = unmapped(branch)
        return ['=>', parameters(tokenAt(arrow)), nodeAt(b)]
    }
    const [, accesses, powTail, ...tailLists] = unmapped(branch)
    return applyTail(withPow(steps(value, unmapped(accesses)), powTail), tailLists)
}

/**
 * What follows the first name inside a `(`, {@link named} in
 * `../grammar/module.f.mjs`: `=>` and the body at the third position of
 * `=> t body ) t access* powTail tail` — a bare arrow in a group, the
 * function of that one name with the group's steps at the sixth position,
 * its power at the seventh and the layers after it applied — or, past the
 * line's end, {@link namedMoreNode}.
 *
 * @type {(first: DjsTokenWithMetadata, node: Children<Named, DjsTokenWithMetadata, Out>) => Node}
 */
const namedNode = (first, [tag, branch]) => {
    if (tag === 'arrow') {
        const [, , b, , , accesses, powTail, ...tailLists] = unmapped(branch)
        return applyTail(withPow(steps(['=>', ['names', [first]], nodeAt(b)], unmapped(accesses)), powTail), tailLists)
    }
    const [, more] = unmapped(branch)
    return namedMoreNode(first, unmapped(more))
}

/**
 * What follows the first name inside a `(` where no arrow does,
 * {@link namedMore} in `../grammar/module.f.mjs`: a comma, the rest of the
 * list — the optional list at the third position of `, t [ names ] ) s =>
 * t body`, read as an array's items are — and the body at the eighth, the
 * function of every name; or the rest of a value the name opened,
 * `access* powTail tail`, then the `)`, its same-line trivia and
 * {@link afterNamed} at the position after them — the parameter list
 * `(a)` where the value is the name alone, the node the steps and layers
 * left being the reference itself, and the refused one where it is more.
 *
 * @type {(first: DjsTokenWithMetadata, node: Children<NamedMore, DjsTokenWithMetadata, Out>) => Node}
 */
const namedMoreNode = (first, [tag, branch]) => {
    if (tag === 'list') {
        const [, , rest, , , , , b] = unmapped(branch)
        return ['=>', ['names', [first, ...toArray(nameItems(rest))]], nodeAt(b)]
    }
    const [accesses, powTail, ...rest] = unmapped(branch)
    /** @type {Node} */
    const name = ['ref', first]
    const value = applyTail(withPow(steps(name, unmapped(accesses)), powTail), rest.slice(0, tail.length))
    // the tail lists are a spread position, typed as `_Leaf` alone, so what
    // stands after them and the `)` is read by the shape `_AfterNameNode`
    // documents
    return afterNamed(value, arrow => value === name ? ['names', [first]] : ['group', arrow], /** @type {_AfterNameNode} */ (rest[tail.length + 2]))
}

/**
 * What a `(` opened, {@link parenthesized} in `../grammar/module.f.mjs`,
 * by the branch its next symbol took: the rest parameter at the third
 * position of `... t name t ) s => t body` and the body at the ninth; an
 * empty list's body at the fifth position of `) s => t body`; a name and
 * what follows it, {@link namedNode}; or a group of a value opening with
 * no name, the steps after its `)` at the fourth position, the power at
 * the fifth and the binary layers after it applied, {@link applyTail} — a
 * function takes none, nothing following one unparenthesized (`unary`'s
 * own comment in `../grammar/module.f.mjs` has why).
 *
 * A group is no node of its own: `(x)` is whatever `x` is, and the steps
 * after the `)` apply to that same node, so nothing downstream can tell a
 * group was written. That is what JavaScript means by parentheses — they
 * keep even a property reference, so `(a.b)(c)` passes `a` as `a.b(c)`
 * does — and it leaves a group no canonical form to choose.
 *
 * @type {(node: Children<Parenthesized, DjsTokenWithMetadata, Out>) => Node}
 */
const parenNode = ([tag, branch]) => {
    switch (tag) {
        case 'rest': {
            const [, , name, , , , , , b] = unmapped(branch)
            return ['=>', ['rest', nameAt(name)], nodeAt(b)]
        }
        case 'empty': {
            const [, , , , b] = unmapped(branch)
            return ['=>', ['names', []], nodeAt(b)]
        }
        case 'named': {
            const [name, , after] = unmapped(branch)
            return namedNode(nameAt(name), unmapped(after))
        }
        case 'group': {
            const [v, , , accesses, powTail, ...tailLists] = unmapped(branch)
            return applyTail(withPow(steps(nodeAt(v), unmapped(accesses)), powTail), tailLists)
        }
    }
}

/**
 * A group's node, from `value ) t access* '**' t unary`: the value at the
 * first position, the steps after the `)` at the fourth applied to it, and
 * the power at the fifth raised over that.
 *
 * @type {(node: Ast<Group, DjsTokenWithMetadata, Out>) => Node}
 */
const groupNode = node => {
    const [v, , , accesses, powTail] = unmapped(node)
    return withPow(steps(nodeAt(v), unmapped(accesses)), powTail)
}

/**
 * A value is the node its branch made, with each access after it, the
 * power over it and the binary layers above it applied in turn — or what a
 * `(` opened, {@link parenNode}, or what a name opened, {@link afterNamed}:
 * the function of that one parameter, or the value the reference is the
 * base of. A body is a value less the object, and its node is made the
 * same way, as is a group's value inside a `(`, a value less the name;
 * `unary` is a value less every binary layer and the name's own choice,
 * its every branch the same but for the trailing tail lists none of them
 * carry, which is what tells this reader whether to call {@link applyTail}
 * at all.
 *
 * A block preserves its ordered `const` declarations and explicit `return`,
 * including when no declaration precedes it. The source tree keeps that
 * syntax until the fold lowers it to an executable function body.
 *
 * A negation and a bitwise not are `op t unary tail*`, `unary` at the
 * third position exactly as a binary layer's own round has it — negated or
 * complemented first, then the tail lists above that, `-2 * 3` reading
 * `(-2) * 3` and not `-(2 * 3)`.
 *
 * @type {(node: Children<Unary, DjsTokenWithMetadata, Out> | Children<Value, DjsTokenWithMetadata, Out> | Children<GroupValue, DjsTokenWithMetadata, Out> | Children<Body, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const toNode = node => {
    if (node[0] === 'paren') {
        return symbol({ id: 'value', node: parenNode(unmapped(unmapped(node[1])[2])) })
    }
    if (node[0] === 'name') {
        const [name, , after] = unmapped(node[1])
        const token = nameAt(name)
        return symbol({ id: 'value', node: afterNamed(['ref', token], () => ['names', [token]], unmapped(after)) })
    }
    if (node[0] === 'group') {
        return symbol({ id: 'value', node: groupNode(unmapped(node[1])[2]) })
    }
    if (node[0] === 'neg' || node[0] === 'bitnot') {
        const [, , v, ...tailLists] = unmapped(node[1])
        return symbol({ id: 'value', node: applyTail([node[0] === 'neg' ? '-' : '~', nodeAt(v)], tailLists) })
    }
    if (node[0] === 'block') {
        const [, , consts, , , v] = unmapped(node[1])
        const statements = unmapped(consts).map(constAt).map(constNode)
        return symbol({ id: 'value', node: ['block', [...statements, ['return', nodeAt(v)]]] })
    }
    const x = unmapped(node[1])[0]
    const [, accesses] = unmapped(x)
    const [, powTail, ...tailLists] = unmapped(node[1])
    const withSteps = steps(baseOf(node), unmapped(accesses))
    return symbol({ id: 'value', node: applyTail(withPow(withSteps, powTail), tailLists) })
}

/**
 * A `-`/`~`'s own operand: {@link unaryOperand}'s branches, read the same
 * way {@link toNode} reads {@link unary}'s but for the power and the
 * binary layers above it, neither of which this rule's grammar admits — a
 * further `-`/`~`, recursing through this same reader by way of
 * {@link nodeAt}, {@link unaryOperand} mapped here exactly as {@link
 * unary} is by `toNode`; a group, whose own steps apply with no power past
 * the `)`; or the base itself, through {@link baseOf}, with only the
 * accesses after it applied.
 *
 * @type {(node: Children<UnaryOperand, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const operandToNode = node => {
    if (node[0] === 'neg' || node[0] === 'bitnot') {
        const [, , v] = unmapped(node[1])
        return symbol({ id: 'value', node: [node[0] === 'neg' ? '-' : '~', nodeAt(v)] })
    }
    if (node[0] === 'group') {
        const [, , g] = unmapped(node[1])
        const [v, , , accesses] = unmapped(g)
        return symbol({ id: 'value', node: steps(nodeAt(v), unmapped(accesses)) })
    }
    const x = unmapped(node[1])[0]
    const [, accesses] = unmapped(x)
    return symbol({ id: 'value', node: steps(baseOf(node), unmapped(accesses)) })
}

/** A declaration in a block's ordered statement list. @type {(statement: Const) => readonly ['const', Const]} */
const constNode = statement => ['const', statement]

/**
 * The token a key is read from, the name it spells, and whether it is the
 * computed spelling — `[ '[' t string t ']' ]`, the string at the third
 * position. The distinction exists for `__proto__` alone.
 *
 * @type {(node: Children<typeof key, DjsTokenWithMetadata, Out>) => readonly [DjsTokenWithMetadata, string, boolean]}
 */
const keyOf = ([tag, branch]) => {
    switch (tag) {
        case 'plain': {
            const t = tokenAt(unmapped(branch)[1])
            return [t, _nameOf(t), false]
        }
        case 'string': {
            const t = tokenAt(branch)
            return [t, _textOf(t), false]
        }
        case 'computed': {
            const t = tokenAt(unmapped(branch)[2])
            return [t, _textOf(t), true]
        }
    }
}

/** @type {(node: Children<typeof member, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toMember = ([k, , , , v]) => {
    const [token, name, computed] = keyOf(unmapped(k))
    return symbol({ id: 'member', member: { key: token, name, computed, value: nodeAt(v) } })
}

/**
 * An import's attribute, when the optional list holds one round: the key at
 * the fifth position of `with t { t identifier t : t string t } t`, under
 * the alternative its word matched, and the value at the ninth.
 *
 * @type {(node: _AttributeNode) => Import['attribute']}
 */
const attributeOf = node => {
    const rounds = unmapped(node)
    if (rounds.length === 0) { return null }
    const round = unmapped(rounds[0])
    return [tokenAt(unmapped(round[4])[1]), tokenAt(round[8])]
}

/** @type {(node: Children<typeof importStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toImport = ([, , name, , , , module, , attribute]) =>
    symbol({ id: 'import', statement: { name: tokenAt(unmapped(name)[1]), module: _textOf(tokenAt(module)), attribute: attributeOf(attribute) } })

/** @type {(node: Children<typeof constStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toConst = ([, , name, , , , v]) =>
    symbol({ id: 'const', statement: { name: tokenAt(unmapped(name)[1]), value: nodeAt(v) } })

/** @type {(node: _Leaf) => ModuleConst} */
const ordinaryConst = node => ({ declaration: constAt(node), exported: false })

/** @type {(node: Children<typeof exportStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toExport = ([, , choice]) => {
    const [kind, branch] = unmapped(choice)
    if (kind === 'default') {
        return symbol({ id: 'export', consts: null, default: nodeAt(unmapped(branch)[2]) })
    }
    const [declaration, consts, tail] = unmapped(branch)
    const next = unmapped(tail)
    const rest = next.length === 0 ? null : exportAt(next[0])
    return symbol({
        id: 'export',
        consts: concat([
            { declaration: constAt(declaration), exported: true },
            ...unmapped(consts).map(ordinaryConst),
        ])(rest === null ? null : rest.consts),
        default: rest === null ? null : rest.default,
    })
}

/** @type {(node: Children<typeof djsModule, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toModule = ([, imports, consts, exported]) => {
    const result = exportAt(exported)
    return symbol({
        id: 'module',
        module: {
            imports: unmapped(imports).map(importAt),
            consts: [...unmapped(consts).map(ordinaryConst), ...toArray(result.consts)],
            exported: result.default,
        },
    })
}

/** @type {Mappings<DjsTokenWithMetadata, Out>} */
const map = mapping

/** @type {(node: Children<Items<Value>, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toValues = node => symbol({ id: 'values', items: valuesOf(node) })

/** @type {(node: Children<Items<Member>, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toMembers = node => symbol({ id: 'members', items: membersOf(node) })

/** @type {(node: Children<ParameterNames, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toNames = node => symbol({ id: 'names', items: namesOf(node) })

/**
 * The rewrite set: a value to its node, a list to its items, a member and
 * each statement to its record, and the module to the records of its
 * statements. Keyed by the rules `../grammar` holds, so that
 * `parser(djsModule, mappings)` yields one symbol carrying the module.
 *
 * @type {RewriteSet<DjsTokenWithMetadata, Out>}
 */
export const mappings = [
    map(value, toNode),
    map(body, toNode),
    // a group's value inside a `(` is a value less the name branch, and
    // the same reader serves it
    map(groupValue, toNode),
    // what a `-` takes is a rule of its own, and its branches are the
    // value's, so the same reader serves it
    map(unary, toNode),
    // a `-`/`~`'s own operand is a further rule of its own, its branches
    // `unary`'s minus the power, so it takes a reader of its own too
    map(unaryOperand, operandToNode),
    map(values, toValues),
    // a call's arguments are that same list, reached through a rule of its
    // own, so the same reader serves both
    map(callArguments, toValues),
    map(member, toMember),
    map(members, toMembers),
    map(parameterNames, toNames),
    map(importStatement, toImport),
    map(constStatement, toConst),
    map(exportStatement, toExport),
    map(djsModule, toModule),
]

// The tree of a whole module is too deep a type for `tsc` to unroll
// through `parser`'s return type (TS2589); the rule is widened to `Rule`
// here, and `moduleAt` reads the one symbol the match is.
const parseModule = parser(/** @type {Rule} */ (djsModule), mappings)

/**
 * Reads the token list as the module its syntax spells: `import`
 * statements, then `const` and `export const` statements, with an optional
 * final `export default`, every statement ended by `;` — a tree of nodes
 * whose names are not yet resolved, which is the fold's to check
 * (`../module.f.mjs`, `parseFromTokens`). A failure past the last token
 * is the end of input rather than a token the reader can point at.
 *
 * @type {(tokenList: List<DjsTokenWithMetadata>) => Result<Module, ParseError>}
 */
export const readFromTokens = tokenList => {
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
