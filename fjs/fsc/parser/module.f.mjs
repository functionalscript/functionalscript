/**
 * The DJS module reader: the rewrite set that folds the tree of the grammar
 * in `./grammar` into a module as the LL(1) backend builds it, and
 * {@link parseFromTokens}, the reader over a token stream.
 *
 * ```text
 * DjsToken stream ==the module grammar, one symbol per token==> tree
 *                 ==the rewrite set: a node per value, a record per statement==> module
 *                 ==the fold: names bound and resolved, keys checked==> AstModule
 * ```
 *
 * A mapping sees one rule's node and no environment, so it builds a node
 * per value — a primitive, a reference by the token that spells it, a
 * container of nodes — and a record per statement, and the names are
 * resolved where the statements are read, after the grammar has matched
 * the whole module. Each `import` binds its local names, each `const` resolves its
 * value against the names bound so far and then binds its own — so
 * `const a = a` is `const not found`, as it is a reference before its
 * declaration in JavaScript. Export names select those bindings into the
 * module result, with an optional final default expression.
 *
 * The grammar sees symbols and the fold sees text, which is the line that
 * decides where a check belongs: every check that has to read a *word* is
 * the fold's — a reference to a name nothing binds, a name bound twice by
 * `import` or `const`, which share one map, a JavaScript keyword bound or
 * referenced, since the tokenizer hands every keyword over as an
 * identifier and a key or the name after `.` may be one, and a bare or
 * string `__proto__` key, which JavaScript reads as an instruction to replace the
 * prototype; the computed spelling `{ ["__proto__"]: v }` denotes an
 * ordinary property and is accepted. The error reported is the first met
 * in document order, and a match that fails builds no module: a malformed
 * suffix is found before any name is resolved. `./README.md` holds the
 * argument.
 *
 * Every walk is a mapping of one node or a loop over an explicit stack:
 * the machine's own stack is on the heap, a list's mapping puts one item
 * before the list its tail's mapping returned, and the resolution walks a
 * value over a stack of frames, so nesting depth and width stay the
 * input's.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { Ast, Children, Meta } from '../../ebnf/ast/types.ts'
 * @import { Mappings, RewriteSet } from '../../ebnf/ll1/types.ts'
 * @import { Rule } from '../../ebnf/types.ts'
 * @import { Primitive } from '../../media/datajs/types.ts'
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { AstAccess, AstArgs, AstArray, AstBinary, AstBitnot, AstCall, AstConditional, AstConst, AstFrameRef, AstFunction, AstNeg, AstImport, AstMember, AstModule, AstModuleRef, AstObject } from '../ast/types.ts'
 * @import { BinaryTag } from '../ast/types.ts'
 * @import { Const, Container, Entry, Import, ImportBinding, Module, ModuleConst, Node, Out, ParseError } from './types.ts'
 * @import { Body, Group, Items, Member, Parenthesized, Unary, UnaryOperand, Value } from './grammar/types.ts'
 * @import { key, primitive } from './grammar/module.f.mjs'
 * @import { _AccessFrame, _AccessNode, _AttributeNode, _BaseNode, _BodyFrame, _CallBranch, _CallFrame, _CircuitNode, _ConditionalFrame, _ConditionalNode, _ContainerFrame, _Env, _Frame, _Ref, _Scope, _KeyBranch, _Leaf, _ListNode, _OptionalList, _ParameterNode, _PowTailNode, _Stack, _State, _TailRound, _TokenStream } from './private.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { at, empty, setReplace } from '../../types/ordered_map/module.f.mjs'
import { assert, assertNotNullish } from '../../asserts/module.f.mjs'
import { keywords, literalWords } from '../../js/keywords/module.f.mjs'
import { prohibitedCalls, prototypeNames } from '../../js/prototype/module.f.mjs'
import { symbolAt, unmapped } from '../../ebnf/ast/module.f.mjs'
import { mapping, parser } from '../../ebnf/ll1/module.f.mjs'
import {
    body, callArguments, constStatement, djsModule, eagerTail, exportStatement, importBinding, importBindings, importStatement, namedImports, member, members, symbolOf,
    unary, unaryOperand, value, values,
} from './grammar/module.f.mjs'

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
 * The word a name token spells. A framing keyword is an identifier too,
 * arriving as the same `id` token; each of the six words that denote a
 * value is a token kind of its own, and *is* its own word.
 *
 * @type {(t: DjsTokenWithMetadata) => string}
 */
const nameOf = ({ token }) => {
    if (token.kind === 'id') { return token.value }
    assert(literalWordSet.has(token.kind), token.kind)
    return token.kind
}

/** @type {(t: DjsTokenWithMetadata) => string} */
const textOf = ({ token }) => {
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

/** The items of a list of values, its tail already mapped. */
const valuesOf = listOf(nodeAt, valuesAt)

/** The members of a list of members, its tail already mapped. */
const membersOf = listOf(memberAt, membersAt)

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
 * The token naming a function's parameter, when the list holds one: the
 * identifier at the third position of `... t id t`, under the alternative
 * its word matched, as a `const`'s name is. An empty list has no token,
 * which is what `null` says — and the fold has no word to bind, so a body
 * under it names nothing.
 *
 * @type {(node: _ParameterNode) => DjsTokenWithMetadata | null}
 */
const parameterOf = node => {
    const rounds = unmapped(node)
    return rounds.length === 0 ? null : tokenAt(unmapped(unmapped(rounds[0])[2])[1])
}

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
 * `multiplicativeOp` through `nullishOp` (`./grammar/module.f.mjs`) each
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
 * `./grammar/module.f.mjs` — so the same reads serve both rules.
 *
 * @type {(node: Exclude<Children<Unary, DjsTokenWithMetadata, Out> | Children<UnaryOperand, DjsTokenWithMetadata, Out> | Children<Value, DjsTokenWithMetadata, Out> | Children<Body, DjsTokenWithMetadata, Out>, readonly ['paren' | 'group' | 'block' | 'neg' | 'bitnot', unknown]>) => Node}
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
 * What a `(` opened, at the third position of `( t (func | group)`: a
 * function, by its parameter list at the first position of
 * `[ ... t id t ] ) s => t body` and its body at the sixth — or a group
 * through the binary layers above it, {@link applyTail} — a function takes
 * none, nothing following one unparenthesized (`unary`'s own comment in
 * `./grammar/module.f.mjs` has why).
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
    if (tag === 'func') {
        const [p, , , , , b] = unmapped(branch)
        return ['=>', parameterOf(p), nodeAt(b)]
    }
    const [g, ...tailLists] = unmapped(branch)
    return applyTail(groupNode(g), tailLists)
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
 * `(` opened, {@link parenNode}. A body is a value less the object, and its
 * node is made the same way; `unary` is a value less every binary layer,
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
 * @type {(node: Children<Unary, DjsTokenWithMetadata, Out> | Children<Value, DjsTokenWithMetadata, Out> | Children<Body, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const toNode = node => {
    if (node[0] === 'paren') {
        return symbol({ id: 'value', node: parenNode(unmapped(unmapped(node[1])[2])) })
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
            return [t, nameOf(t), false]
        }
        case 'string': {
            const t = tokenAt(branch)
            return [t, textOf(t), false]
        }
        case 'computed': {
            const t = tokenAt(unmapped(branch)[2])
            return [t, textOf(t), true]
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
const toImportBinding = ([name, , alias]) => {
    const exported = tokenAt(unmapped(name)[1])
    const rounds = unmapped(alias)
    const local = rounds.length === 0 ? exported : tokenAt(unmapped(unmapped(rounds[0])[2])[1])
    return symbol({ id: 'importBinding', binding: { name: nameOf(exported), local } })
}

/** @type {(node: _ListNode) => Meta<Out>} */
const toImportBindings = node => symbol({ id: 'importBindings', items: importBindingsOf(node) })

/** @type {(node: Children<typeof namedImports, DjsTokenWithMetadata, Out>) => readonly ImportBinding[]} */
const namedBindings = ([, , bindings]) => toArray(importItems(bindings))

/** @type {(node: Children<typeof importStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toImport = ([, , clause, , , module, , attribute]) => {
    const [kind, branch] = unmapped(clause)
    /** @type {readonly ImportBinding[]} */
    let bindings
    if (kind === 'named') { bindings = namedBindings(unmapped(branch)) }
    else {
        const [name, , more] = unmapped(branch)
        const rounds = unmapped(more)
        bindings = [
            { name: 'default', local: tokenAt(unmapped(name)[1]) },
            ...(rounds.length === 0 ? [] : namedBindings(unmapped(unmapped(rounds[0])[2]))),
        ]
    }
    return symbol({ id: 'import', statement: { bindings, module: textOf(tokenAt(module)), attribute: attributeOf(attribute) } })
}

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
    map(importBinding, toImportBinding),
    map(importBindings, toImportBindings),
    map(importStatement, toImport),
    map(constStatement, toConst),
    map(exportStatement, toExport),
    map(djsModule, toModule),
]

// -- resolving the names ------------------------------------------------------

/**
 * The key of `{ __proto__: v }` and `{ "__proto__": v }`. JavaScript reads
 * both as an instruction to replace the object's prototype instead of as a
 * property, so FunctionalScript rejects them and accepts only the computed
 * spelling `{ ["__proto__"]: v }`, which denotes an ordinary property.
 * See [spec: the `__proto__` key](../../../spec/README.md#the-__proto__-key).
 */
const protoKey = '__proto__'

/** @type {(message: string) => (t: DjsTokenWithMetadata) => ParseError} */
const foldError = message => ({ metadata }) => ({ message, metadata })

/** A plain `__proto__` key, at the key. */
const protoKeyError = foldError('__proto__ requires the computed key form')

/** A reference to a name nothing binds, at the reference. */
const constNotFound = foldError('const not found')

/** A name bound twice, at the second binding. */
const duplicateId = foldError('duplicate id')

/**
 * A body `const` binding a name the body has already read from a scope
 * around it, at the binding. JavaScript resolves every reference in the
 * body to the body's own `const`, the ones before it included — a read
 * before it is initialized throws, and a function written before it reads
 * it once called — so the capture already taken would be a different
 * value, and the program is refused instead. Not a rule of the language,
 * which leaks nothing here, but a forward reference inside a body not yet
 * supported: `./todo/body-const-forward-reference.md`.
 */
const captureShadowed = foldError('capture shadowed')

/** A keyword where JavaScript wants an identifier, at the word. */
const reservedWord = foldError('reserved word')

/** The arguments of the function whose body is being resolved. @type {AstArgs} */
const args = ['args']

/** @type {ReadonlySet<string>} */
const keywordSet = new Set(keywords)

/**
 * The words that denote a value, which the tokenizer gives token kinds of
 * their own. A name position takes them — a property is named by an
 * ECMAScript `IdentifierName`, which admits every reserved word — and
 * {@link identifierOf} then refuses them where a *binding* is wanted, as it
 * refuses every other keyword.
 *
 * @type {ReadonlySet<string>}
 */
const literalWordSet = new Set(/** @type {readonly string[]} */(literalWords))

/**
 * The word an identifier token spells where JavaScript wants an identifier
 * — a name bound or referenced — refusing every keyword: the tokenizer
 * demotes them all to `id`, so that a key or the name after `.` may be one,
 * and here is where the distinction is made. `const if = 1;` is a syntax
 * error in JavaScript, so it is an error here.
 *
 * @type {(name: DjsTokenWithMetadata) => Result<string, ParseError>}
 */
const identifierOf = name => {
    const word = nameOf(name)
    return keywordSet.has(word) ? error(reservedWord(name)) : ok(word)
}

/** An attribute key the language does not know, at the key: `type` is the one JavaScript defines. */
const unknownAttribute = foldError('unknown import attribute')

/** A module type the language does not read, at the value: `json` is the one JavaScript defines. */
const unknownType = foldError('unknown import type')

/**
 * An import as the AST records it: its specifier, and whether its attribute
 * names a JSON module — the one attribute JavaScript defines, `type`, with
 * the one value it reads, `json`; any other key or value is refused where
 * it stands.
 *
 * @type {(statement: Import) => Result<Omit<AstImport, 'name'>, ParseError>}
 */
const imported = ({ module, attribute }) => {
    if (attribute === null) { return ok({ specifier: module, json: false }) }
    const [key, value] = attribute
    if (nameOf(key) !== 'type') { return error(unknownAttribute(key)) }
    if (textOf(value) !== 'json') { return error(unknownType(value)) }
    return ok({ specifier: module, json: true })
}

/**
 * A key that names a property of a built-in prototype, at the key, in
 * either spelling. An access reads an own property, and JavaScript reads
 * the prototype's where the value owns none: `a.push` is a function there
 * and nothing here, `a.__proto__` and `a.constructor` reach a function's
 * constructor through any object — so every such name is refused, as
 * [spec: property accessor](../../../spec/todo/2330-property-accessor.md)
 * has it, and a module means one thing in both languages.
 */
const prohibitedKey = foldError('prohibited property name')

/**
 * The refusal of a method call's key: a member function a module may not
 * call, `a.push(1)` or `a.valueOf()` — a mutator, the prototype protocol, a
 * locale-dependent or regular-expression method, and the rest
 * `fjs/js/prototype`'s `prohibitedCalls` names, its README saying why for
 * each. The other prototype names are member functions the VM answers by
 * the receiver's type, so `a.at(0)` and `a.toString()` are calls like any
 * other, though `a.at` and `a.toString` stay refused as reads: a detached
 * built-in is a function that only fails.
 */
const prohibitedCall = foldError('prohibited member function')

/**
 * The names an access may not read: every name a built-in prototype gives
 * a value, `fjs/js/prototype`, but `length` — an own property of an array,
 * a string and a function, which the two languages read alike.
 *
 * Exported for the writer in [`../serializer`](../serializer/module.f.mjs),
 * which refuses the same names rather than write an access the parser here
 * would not read back: the rule is the language's, and it has one owner.
 * The `_` says that export is linkage rather than API, as it does for
 * `_tokenKindNames` in [`./grammar`](./grammar/module.f.mjs).
 *
 * @type {ReadonlySet<string>}
 */
export const _prohibitedNames = new Set(prototypeNames.filter(name => name !== 'length'))

/**
 * The names a method call may not call: `prohibitedCalls`, as a set.
 *
 * @type {ReadonlySet<string>}
 */
const prohibitedCallNames = new Set(prohibitedCalls)

/** What an access's key token names: a name's word, the string's text, or the number. @type {(t: DjsTokenWithMetadata) => string | number} */
const keyNamed = t => {
    const { token } = t
    switch (token.kind) {
        case 'string': { return token.value }
        case 'number': { return parseFloat(token.value) }
        default: { return nameOf(t) }
    }
}

/**
 * An access closed over its base: the AST's `['.', base, key]`, or the
 * refusal of its key — a name of the prototype chain where the access is
 * read, and a member function a module may not call where it is a call's
 * callee, `frame.method`. The two rules are `fjs/js/prototype`'s two
 * lists, and the access's shape is the same either way: the lowering
 * makes the callee access a method call, `['.', a, 'b', ['|()', args]]`.
 *
 * @type {(frame: _AccessFrame, base: AstConst) => Result<AstConst, ParseError>}
 */
const accessClosed = (frame, base) => {
    const { key, method } = frame
    const named = keyNamed(key)
    if (typeof named === 'string') {
        if (method && prohibitedCallNames.has(named)) { return error(prohibitedCall(key)) }
        if (!method && _prohibitedNames.has(named)) { return error(prohibitedKey(key)) }
    }
    /** @type {AstAccess} */
    const access = ['.', base, named]
    return ok(access)
}

/**
 * Whether the node being entered is a call's callee: the frame on top is
 * the call's, with no operand done yet. An access entered there is a method
 * call's, and its key is checked as one — through a group as well, since
 * `(a.b)(c)` is the node `a.b(c)` is by the time it is entered.
 *
 * @type {(stack: _Stack) => boolean}
 */
const isCallee = stack => stack !== null && 'call' in stack.top && stack.top.index === 0

/** @type {(container: Container, index: number) => Node} */
const itemAt = ([kind, items], index) =>
    kind === 'array' ? items[index] : items[index].value

/**
 * The error a container's item earns before its value is read, or `null`:
 * a plain `__proto__` key, at the key itself.
 *
 * Checked as each member is reached rather than by scanning every key
 * first, so that an earlier member's failure is reported before a later
 * key's: `{a: missing, __proto__: 1}` reports the unresolved `missing`.
 * Errors are first-to-last, and a key is not special enough to jump the
 * queue.
 *
 * @type {(container: Container, index: number) => ParseError | null}
 */
const badKey = ([kind, items], index) => {
    if (kind === 'array') { return null }
    const { key, name, computed } = items[index]
    return name === protoKey && !computed ? protoKeyError(key) : null
}

/**
 * A member as an entry of the object being closed: its name, and the value
 * at its index among the resolved values, which are the leading parameter
 * so that the step lives here rather than closing over them.
 *
 * @type {(done: readonly AstConst[]) => (member: Entry, index: number) => AstMember}
 */
const memberEntry = done => ({ name }, index) => [name, done[index]]

/**
 * A container of the values its items resolved to: an array, or an object
 * of its members in the order they are written, a repeated key written
 * twice. The order is not the parser's to change — it is the order the
 * graph a module denotes has, as JavaScript reads the same literal — and
 * the duplicates are not its to collapse: `run` builds the object
 * JavaScript builds, and EDAG's object constructor takes the members as
 * written, which the syntax alone still has.
 *
 * @type {(container: Container, done: readonly AstConst[]) => AstConst}
 */
const close = ([kind, members], done) => {
    if (kind === 'array') {
        /** @type {AstArray} */
        const array = ['array', done]
        return array
    }
    /** @type {AstObject} */
    const object = ['object', members.map(memberEntry(done))]
    return object
}

/**
 * The next item of a container, its key checked first, or the container
 * closed when none is left.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _ContainerFrame) => _State}
 */
const round = (stack, scope, frame) => {
    const { container, index, done } = frame
    if (index >= container[1].length) { return [stack, scope, ok(close(container, toArray(done)))] }
    const rejected = badKey(container, index)
    return rejected === null
        ? [{ top: frame, rest: stack }, scope, ['enter', itemAt(container, index)]]
        : [stack, scope, error(rejected)]
}

/**
 * How many operands a call has: its callee and its arguments.
 *
 * Counted and indexed rather than built into one list, which is what
 * `[callee, ...args]` per round would be — a copy of every argument for
 * each of them, and quadratic in a call's width where the parser is linear
 * in an array's.
 *
 * @type {(call: _CallFrame['call']) => number}
 */
const callOperandCount = call => call[2].length + 1

/**
 * The operand a call evaluates at `index`: the callee first, then each
 * argument as written — JavaScript's own order, and the order an error
 * among them is reported in.
 *
 * @type {(call: _CallFrame['call'], index: number) => Node}
 */
const callOperandAt = (call, index) => index === 0 ? call[1] : call[2][index - 1]

/**
 * The next operand of a call, or the call closed when none is left: the
 * first value is the callee and the rest its arguments.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _CallFrame) => _State}
 */
const callRound = (stack, scope, frame) => {
    const { call, index } = frame
    if (index < callOperandCount(call)) { return [{ top: frame, rest: stack }, scope, ['enter', callOperandAt(call, index)]] }
    const [callee, ...args] = toArray(frame.done)
    /** @type {AstCall} */
    const closed = ['()', callee, args]
    return [stack, scope, ok(closed)]
}

/**
 * The operand a conditional evaluates at `index`: the condition, then each
 * arm as written.
 *
 * @type {(conditional: _ConditionalFrame['conditional'], index: number) => Node}
 */
const conditionalOperandAt = ([, condition, then, otherwise], index) => [condition, then, otherwise][index]

/**
 * The next operand of a conditional, or the conditional closed when none
 * is left: the condition first, then each arm as written — resolved all
 * three, since a name is checked where it is written whether or not the
 * program ever establishes the arm, as JavaScript's early errors are.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _ConditionalFrame) => _State}
 */
const conditionalRound = (stack, scope, frame) => {
    const { conditional, index } = frame
    if (index < 3) { return [{ top: frame, rest: stack }, scope, ['enter', conditionalOperandAt(conditional, index)]] }
    const [condition, then, otherwise] = toArray(frame.done)
    /** @type {AstConditional} */
    const closed = ['?:', condition, then, otherwise]
    return [stack, scope, ok(closed)]
}

/** Whether two references name one binding. @type {(a: _Ref, b: _Ref) => boolean} */
const sameRef = (a, b) => a[0] === b[0] && a[1] === b[1]

/**
 * What `word` names in `scope`, and the scope chain with any capture it
 * takes, or `null` where nothing binds it: a name the scope binds itself,
 * and otherwise what the scope around it resolves the word to, which the
 * body captures — one slot of its frame per binding, however many
 * references reach it, numbered in the order the body first names them —
 * and names as `['fref', i]`. A function nested in another captures
 * through it: the word resolved in the middle body first, as a capture of
 * its own there, and that slot captured in turn.
 *
 * A loop rather than a recursion, as {@link evaluate} is: out to the scope
 * that binds the word, then back in, each body on the way rebuilt around
 * the one outside it with its capture taken — so a capture however many
 * functions deep costs no call stack.
 *
 * @type {(scope: _Scope, word: string) => readonly [_Scope, _Ref] | null}
 */
const resolve = (scope, word) => {
    /** The bodies the word is read through, the one just inside the binding scope on top. @type {List<_Scope>} */
    let through = null
    let binder = scope
    let ref = at(word)(binder.names)
    while (ref === null) {
        if (binder.outer === null) { return null }
        through = { first: binder, tail: through }
        binder = binder.outer
        ref = at(word)(binder.names)
    }
    /** @type {readonly [_Scope, _Ref]} */
    let result = [binder, ref]
    for (const body of toArray(through)) {
        result = captured(body, word, result)
    }
    return result
}

/**
 * A body with the value the scope around it resolved `word` to captured,
 * that scope rebuilt as its `outer`: the slot the body already has for the
 * binding, or a new one after the rest.
 *
 * @type {(body: _Scope, word: string, outer: readonly [_Scope, _Ref]) => readonly [_Scope, _Ref]}
 */
const captured = (body, word, [outer, ref]) => {
    const i = body.captures.findIndex(c => sameRef(c, ref))
    /** @type {AstFrameRef} */
    const slot = ['fref', i === -1 ? body.captures.length : i]
    return [{
        ...body,
        outer,
        captures: i === -1 ? [...body.captures, ref] : body.captures,
        read: body.read.includes(word) ? body.read : [...body.read, word],
    }, slot]
}

/**
 * The names a function's body begins with: its parameter bound to the
 * arguments array, and nothing else of its own — a name bound outside is
 * a capture, {@link resolve}.
 *
 * An empty parameter list binds nothing, so a body under it starts from no
 * names of its own: the arguments are unreachable, having no name, and
 * every other word is a capture or `const not found` exactly as it is
 * under a parameter that does not spell it. That is the whole of what an empty
 * list costs: the function the fold returns carries no parameter either
 * way, so nothing downstream can tell the two lists apart.
 *
 * @type {(name: DjsTokenWithMetadata | null) => Result<_Env, ParseError>}
 */
const functionScope = name => {
    if (name === null) { return ok(empty) }
    const [tag, word] = identifierOf(name)
    return tag === 'error' ? error(word) : ok(setReplace(word)(args)(empty))
}

/**
 * The next step of a function's block body: the `const` at `index`, its name
 * checked before its value is entered — as a module's `const` is, so that a
 * statement wrong in both halves answers for the half a reader meets first
 * — or the expression of the explicit final `return`.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _BodyFrame) => _State}
 */
const bodyRound = (stack, scope, frame) => {
    const { statements, index } = frame
    const [kind, statement] = statements[index]
    if (kind === 'return') { return [{ top: frame, rest: stack }, scope, ['enter', statement]] }
    const [tag, word] = bindable(scope.names)(statement.name)
    if (tag === 'error') { return [stack, scope, error(word)] }
    // a name the body already read from outside is refused before the
    // value is read, and one its own initializer reads once it has been
    // (`returned`)
    if (scope.read.includes(word)) { return [stack, scope, error(captureShadowed(statement.name))] }
    return [{ top: { ...frame, word }, rest: stack }, scope, ['enter', statement.value]]
}

/**
 * Enters a node: a primitive is its value, a reference what `scope`
 * resolves its name to — a capture, where a function's body names what a
 * scope around it binds, {@link resolve} — an access its base under a
 * frame holding the key, a container, a call or a conditional the first
 * round of a new frame, an operator its left operand under a frame holding
 * the right, and a function its body, in a scope of its own inside
 * `scope`. A name no scope binds is `const not found`.
 *
 * A block body is entered the same way, under a frame that also holds its
 * statements: the parameter is the only name bound when the first of them
 * is resolved — none is, where the list is empty — and each binds its own
 * as the module's `const`s do.
 *
 * @type {(stack: _Stack, scope: _Scope, node: Node) => _State}
 */
const enter = (stack, scope, node) => {
    switch (node[0]) {
        case 'primitive': { return [stack, scope, ok(node[1])] }
        case 'ref': {
            const [tag, word] = identifierOf(node[1])
            if (tag === 'error') { return [stack, scope, error(word)] }
            const found = resolve(scope, word)
            return found === null ? [stack, scope, error(constNotFound(node[1]))] : [stack, found[0], ok(found[1])]
        }
        case '.': { return [{ top: { key: node[2], method: isCallee(stack) }, rest: stack }, scope, ['enter', node[1]]] }
        case '()': { return callRound(stack, scope, { call: node, index: 0, done: null }) }
        case '-': {
            return node.length === 2
                ? [{ top: { neg: true }, rest: stack }, scope, ['enter', node[1]]]
                : [{ top: { tag: node[0], right: node[2] }, rest: stack }, scope, ['enter', node[1]]]
        }
        case '~': { return [{ top: { bitnot: true }, rest: stack }, scope, ['enter', node[1]]] }
        case '*': case '/': case '%': case '**':
        case '+':
        case '===': case '!==': case '<': case '<=': case '>': case '>=':
        case '&': case '|': case '^': case '<<': case '>>': case '>>>':
        case '&&': case '||': case '??': {
            return [{ top: { tag: node[0], right: node[2] }, rest: stack }, scope, ['enter', node[1]]]
        }
        case '?:': { return conditionalRound(stack, scope, { conditional: node, index: 0, done: null }) }
        case '=>': {
            const [tag, names] = functionScope(node[1])
            if (tag === 'error') { return [stack, scope, error(names)] }
            /** @type {_Scope} */
            const inner = { names, captures: [], read: [], outer: scope }
            const body = node[2]
            return body[0] === 'block'
                ? bodyRound(stack, inner, { statements: body[1], index: 0, word: '', done: null })
                : [{ top: { function: true }, rest: stack }, inner, ['enter', body]]
        }
        // a block stands only as a function's body, which `'=>'` above
        // enters; the mapping writes one nowhere else
        default: { return round(stack, scope, { container: /** @type {Container} */ (node), index: 0, done: null }) }
    }
}

/**
 * A value handed to the frame on top: the next round of a container with
 * the value among its items, an access closed over its base, or a function
 * closed over its body, {@link closed}.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _Frame, value: AstConst) => _State}
 */
const returned = (stack, scope, frame, value) => {
    if ('container' in frame) { return round(stack, scope, { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }) }
    if ('call' in frame) { return callRound(stack, scope, { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }) }
    if ('conditional' in frame) { return conditionalRound(stack, scope, { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }) }
    if ('key' in frame) { return [stack, scope, accessClosed(frame, value)] }
    if ('neg' in frame) {
        /** @type {AstNeg} */
        const negated = ['-', value]
        return [stack, scope, ok(negated)]
    }
    if ('bitnot' in frame) {
        /** @type {AstBitnot} */
        const complemented = ['~', value]
        return [stack, scope, ok(complemented)]
    }
    if ('right' in frame) { return [{ top: { tag: frame.tag, left: value }, rest: stack }, scope, ['enter', frame.right]] }
    if ('left' in frame) {
        /** @type {AstBinary} */
        const binary = [frame.tag, frame.left, value]
        return [stack, scope, ok(binary)]
    }
    if ('statements' in frame) {
        const [kind, statement] = frame.statements[frame.index]
        if (kind === 'const') {
            // a name its own initializer read from outside
            if (scope.read.includes(frame.word)) { return [stack, scope, error(captureShadowed(statement.name))] }
            // the binding lands after the value, keeping the name out of its
            // own initializer's scope, and names entry `index` of this body
            return bodyRound(
                stack,
                { ...scope, names: extended(scope.names)(frame.word, ['cref', frame.index]) },
                { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) })
        }
        return closed(stack, scope, [...toArray(frame.done), value])
    }
    return closed(stack, scope, [value])
}

/**
 * A function closed over its body, resolved in `scope`: the scope around
 * it in force again — with every capture the body took on the way — and
 * the body's own captures, where there are any, the function's third
 * element.
 *
 * @type {(stack: _Stack, scope: _Scope, body: readonly AstConst[]) => _State}
 */
const closed = (stack, scope, body) => {
    const outer = assertNotNullish(scope.outer, ['a function body with no scope around it', body])
    /** @type {AstFunction} */
    const fn = scope.captures.length === 0 ? ['=>', body] : ['=>', body, scope.captures]
    return [stack, outer, ok(fn)]
}

/**
 * The value a node denotes under `env`, or the first error met in document
 * order: a reference to a keyword, to a name bound outside the function
 * being resolved, or to a name nothing binds, a plain `__proto__` key, or
 * an access naming a built-in prototype's property.
 *
 * Over an explicit stack: a frame per container being built, its items
 * resolved in order, and per function, its body resolved under its own
 * names, so that a value nested as deep as the input allows costs no call
 * stack.
 *
 * @type {(env: _Env) => (root: Node) => Result<AstConst, ParseError>}
 */
const evaluate = env => root => {
    /** @type {_State} */
    let state = [null, { names: env, captures: [], read: [], outer: null }, ['enter', root]]
    while (true) {
        const [stack, scope, [tag, payload]] = state
        if (tag === 'enter') {
            state = enter(stack, scope, payload)
        } else if (tag === 'error') {
            return error(payload)
        } else if (stack === null) {
            return ok(payload)
        } else {
            state = returned(stack.rest, scope, stack.top, payload)
        }
    }
}

/**
 * The word a binding may take: an identifier, refusing a keyword, and one
 * the environment does not hold — `import` and `const` share the one map,
 * so a name taken by either is taken for both.
 *
 * Separate from the binding itself because a `const` asks the two questions
 * at different moments: its name is refused before its value is read, so
 * that `const NaN = missing;` answers for the name and not for `missing`,
 * while the binding lands after, keeping the name out of its own
 * initializer's scope.
 *
 * @type {(env: _Env) => (name: DjsTokenWithMetadata) => Result<string, ParseError>}
 */
const bindable = env => name => {
    const [tag, word] = identifierOf(name)
    if (tag === 'error') { return error(word) }
    return at(word)(env) !== null ? error(duplicateId(name)) : ok(word)
}

/** The environment with a word bound to a reference, its two questions already answered. @type {(env: _Env) => (word: string, ref: AstModuleRef | AstArgs) => _Env} */
const extended = env => (word, ref) => setReplace(word)(ref)(env)

/**
 * The statements of a module, in order: each imported binding names
 * the next argument, each `const` resolves its value against the names
 * bound so far — itself not among them, so a `cref` always names an earlier
 * entry — and then binds its name. The default export is resolved against
 * them all and placed in the module's result object. Ordinary function bodies
 * keep their own return values.
 *
 * @type {(module: Module) => Result<AstModule, ParseError>}
 */
const foldModule = ({ imports, consts, exported }) => {
    /** @type {_Env} */
    let env = empty
    /** @type {readonly AstImport[]} */
    let modules = []
    /** @type {readonly AstConst[]} */
    let body = []
    /** @type {readonly AstMember[]} */
    let exports = []
    for (const statement of imports) {
        let index = modules.length
        for (const { local } of statement.bindings) {
            const [tag, word] = bindable(env)(local)
            if (tag === 'error') { return error(word) }
            env = extended(env)(word, ['aref', index])
            index += 1
        }
        const [read, record] = imported(statement)
        if (read === 'error') { return error(record) }
        modules = [
            ...modules,
            ...(statement.bindings.length === 0
                ? [{ ...record, name: null }]
                : statement.bindings.map(({ name }) => ({ ...record, name }))),
        ]
    }
    for (const { declaration: { name, value: node }, exported: named } of consts) {
        // the name first: a statement wrong in both halves answers for the
        // half a reader meets first
        const [tag, word] = bindable(env)(name)
        if (tag === 'error') { return error(word) }
        if (named && word === 'then') { return error({ message: 'reserved export name then', metadata: name.metadata }) }
        const [resolved, value] = evaluate(env)(node)
        if (resolved === 'error') { return error(value) }
        env = extended(env)(word, ['cref', body.length])
        if (named) { exports = [...exports, [word, ['cref', body.length]]] }
        body = [...body, value]
    }
    if (exported !== null) {
        const [resolved, last] = evaluate(env)(exported)
        if (resolved === 'error') { return error(last) }
        exports = [...exports, ['default', last]]
    }
    // annotated rather than inferred: a bare `[modules, body]` widens to an
    // array, because `readonly string[]` is itself assignable to `AstBody`.
    /** @type {AstModule} */
    const astModule = [modules, [...body, ['object', toArray(sort(exports))]]]
    return ok(astModule)
}

// The tree of a whole module is too deep a type for `tsc` to unroll
// through `parser`'s return type (TS2589); the rule is widened to `Rule`
// here, and `moduleAt` reads the one symbol the match is.
const parseModule = parser(/** @type {Rule} */ (djsModule), mappings)

/**
 * Reads the token list as a FunctionalScript module: `import` statements, then
 * `const` and `export const` statements, with an optional final `export default`.
 * At least one export is required; every statement ends with `;`.
 *
 * This is the only language the parser reads. A JSON document is data, not a
 * module, and `fjs/media/json` is its reader
 * ([spec: JSON input](../../../spec/README.md#json-input)).
 *
 * The grammar it accepts is written down in `./grammar`, and what the
 * grammar accepts and this refuses is the fold's: a name unbound or bound
 * twice, and a plain `__proto__` key.
 *
 * @type {(tokenList: List<DjsTokenWithMetadata>) => Result<AstModule, ParseError>}
 */
export const parseFromTokens = tokenList => {
    const [tag, module] = _parseSyntaxFromTokens(tokenList)
    return tag === 'error' ? error(module) : foldModule(module)
}

/**
 * Internal syntax reader shared with source-tree proofs. Its result has not
 * passed binding, JavaScript early-error or FunctionalScript admission checks;
 * callers compiling source use `parseFromTokens`.
 *
 * @type {(tokenList: List<DjsTokenWithMetadata>) => Result<Module, ParseError>}
 */
export const _parseSyntaxFromTokens = tokenList => {
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
