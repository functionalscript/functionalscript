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
 * the whole module. Each `import` binds its name, each `const` resolves its
 * value against the names bound so far and then binds its own — so
 * `const a = a` is `const not found`, as it is a reference before its
 * declaration in JavaScript — and the export is the module's last value.
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
 * @import { Children, Meta } from '../../ebnf/ast/types.ts'
 * @import { Mappings, RewriteSet } from '../../ebnf/ll1/types.ts'
 * @import { Rule } from '../../ebnf/types.ts'
 * @import { Primitive } from '../../media/datajs/types.ts'
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { AstAccess, AstArgs, AstArray, AstCall, AstConst, AstFunction, AstNeg, AstImport, AstMember, AstModule, AstModuleRef, AstObject } from '../ast/types.ts'
 * @import { Const, Container, Entry, Import, Module, Node, Out, ParseError } from './types.ts'
 * @import { Body, Items, Member, Parenthesized, Unary, Value } from './grammar/types.ts'
 * @import { key, primitive } from './grammar/module.f.mjs'
 * @import { _AccessNode, _AttributeNode, _BodyFrame, _CallBranch, _CallFrame, _ContainerFrame, _Env, _Frame, _KeyBranch, _Leaf, _ListNode, _OptionalList, _Stack, _State, _TokenStream } from './private.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { at, empty, setReplace } from '../../types/ordered_map/module.f.mjs'
import { assert } from '../../asserts/module.f.mjs'
import { keywords, literalWords } from '../../js/keywords/module.f.mjs'
import { prototypeNames } from '../../js/prototype/module.f.mjs'
import { symbolAt, unmapped } from '../../ebnf/ast/module.f.mjs'
import { mapping, parser } from '../../ebnf/ll1/module.f.mjs'
import {
    body, callArguments, constStatement, djsModule, exportStatement, importStatement, member, members, symbolOf, unary, value,
    values,
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

/** @type {(node: _Leaf) => Node} */
const exportAt = node => {
    const out = outAt(node)
    assert(out.id === 'export')
    return out.node
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
 * The node a value's own part makes, before the accesses after it: a
 * primitive converted from its token, a reference by its token, and a
 * container of the items its list returned — `[ open t [ items ] close t
 * ]`, the list at the third position. What a `(` opens, a block and a
 * negation are not here: a function, a block and a negation take no access,
 * so each node is made whole, and a group's value is reached through
 * {@link parenNode}.
 *
 * @type {(node: Exclude<Children<Unary, DjsTokenWithMetadata, Out> | Children<Value, DjsTokenWithMetadata, Out> | Children<Body, DjsTokenWithMetadata, Out>, readonly ['paren' | 'block' | 'neg', unknown]>) => Node}
 */
const baseOf = ([tag, branch]) => {
    switch (tag) {
        case 'primitive': { return ['primitive', primitiveOf(unmapped(unmapped(unmapped(branch)[0])[0]))] }
        case 'ref': { return ['ref', tokenAt(unmapped(unmapped(unmapped(branch)[0])[0])[1])] }
        case 'array': { return ['array', toArray(valueItems(unmapped(unmapped(branch)[0])[2]))] }
        case 'object': { return ['object', toArray(memberItems(unmapped(unmapped(branch)[0])[2]))] }
    }
}

/**
 * What a `(` opened, at the third position of `( t (func | group)`: a
 * function, by the token naming its parameter at the third position of
 * `... t id t ) s => t body` and its body at the ninth — or a group, the
 * value at the first position of `value ) t access*` and the steps after
 * the `)` at the fourth.
 *
 * A group is no node of its own: `(x)` is whatever `x` is, and the steps
 * after the `)` apply to that same node, so nothing downstream can tell a
 * group was written. That is what JavaScript means by parentheses — they
 * keep even a property reference, so `(a.b)(c)` passes `a` as `a.b(c)`
 * does — and it leaves a group no canonical form to choose.
 *
 * @type {(node: Children<Parenthesized, DjsTokenWithMetadata, Out>) => Node}
 */
const parenNode = node => {
    if (node[0] === 'func') {
        const [, , name, , , , , , b] = unmapped(node[1])
        return ['=>', tokenAt(unmapped(name)[1]), nodeAt(b)]
    }
    const [v, , , accesses] = unmapped(node[1])
    return steps(nodeAt(v), unmapped(accesses))
}

/**
 * A value is the node its branch made, with each access after it applied
 * in turn — the accesses at the second position of every branch, after
 * the value's own part — or what a `(` opened, {@link parenNode}. A body is
 * a value less the object, and its node is made the same way.
 *
 * A block body is its `const` statements and the value it returns, at the
 * third and sixth positions of `{ t const* return s value ; t } t`. With no
 * statement it is that value and nothing more: `{ return v; }` and `v` are
 * one function in JavaScript, so they are one node here, and nothing
 * downstream sees a block at all — which is what keeps a body `const` from
 * costing anything where none is written.
 *
 * @type {(node: Children<Unary, DjsTokenWithMetadata, Out> | Children<Value, DjsTokenWithMetadata, Out> | Children<Body, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const toNode = node => {
    if (node[0] === 'paren') {
        return symbol({ id: 'value', node: parenNode(unmapped(unmapped(node[1])[2])) })
    }
    if (node[0] === 'neg') {
        const [, , v] = unmapped(node[1])
        return symbol({ id: 'value', node: ['-', nodeAt(v)] })
    }
    if (node[0] === 'block') {
        const [, , consts, , , v] = unmapped(node[1])
        const statements = unmapped(consts).map(constAt)
        const returns = nodeAt(v)
        return symbol({ id: 'value', node: statements.length === 0 ? returns : ['block', statements, returns] })
    }
    const [, accesses] = unmapped(node[1])
    return symbol({ id: 'value', node: steps(baseOf(node), unmapped(accesses)) })
}

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

/** @type {(node: Children<typeof importStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toImport = ([, , name, , , , module, , attribute]) =>
    symbol({ id: 'import', statement: { name: tokenAt(unmapped(name)[1]), module: textOf(tokenAt(module)), attribute: attributeOf(attribute) } })

/** @type {(node: Children<typeof constStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toConst = ([, , name, , , , v]) =>
    symbol({ id: 'const', statement: { name: tokenAt(unmapped(name)[1]), value: nodeAt(v) } })

/** @type {(node: Children<typeof exportStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toExport = ([, , , , v]) => symbol({ id: 'export', node: nodeAt(v) })

/** @type {(node: Children<typeof djsModule, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toModule = ([, imports, consts, exported]) => symbol({
    id: 'module',
    module: {
        imports: unmapped(imports).map(importAt),
        consts: unmapped(consts).map(constAt),
        exported: exportAt(exported),
    },
})

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
    map(values, toValues),
    // a call's arguments are that same list, reached through a rule of its
    // own, so the same reader serves both
    map(callArguments, toValues),
    map(member, toMember),
    map(members, toMembers),
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

/** A keyword where JavaScript wants an identifier, at the word. */
const reservedWord = foldError('reserved word')

/** A reference in a function's body to a name bound outside it, at the reference: a function has no frame yet. */
const capture = foldError('capture not supported')

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
 * @type {(statement: Import) => Result<AstImport, ParseError>}
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
 * refusal of a key that names the prototype chain.
 *
 * @type {(key: DjsTokenWithMetadata, base: AstConst) => Result<AstConst, ParseError>}
 */
const accessClosed = (key, base) => {
    const named = keyNamed(key)
    if (typeof named === 'string' && _prohibitedNames.has(named)) { return error(prohibitedKey(key)) }
    /** @type {AstAccess} */
    const access = ['.', base, named]
    return ok(access)
}

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
 * @type {(stack: _Stack, env: _Env, frame: _ContainerFrame) => _State}
 */
const round = (stack, env, frame) => {
    const { container, index, done } = frame
    if (index >= container[1].length) { return [stack, env, ok(close(container, toArray(done)))] }
    const rejected = badKey(container, index)
    return rejected === null
        ? [{ top: frame, rest: stack }, env, ['enter', itemAt(container, index)]]
        : [stack, env, error(rejected)]
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
 * @type {(stack: _Stack, env: _Env, frame: _CallFrame) => _State}
 */
const callRound = (stack, env, frame) => {
    const { call, index } = frame
    if (index < callOperandCount(call)) { return [{ top: frame, rest: stack }, env, ['enter', callOperandAt(call, index)]] }
    const [callee, ...args] = toArray(frame.done)
    /** @type {AstCall} */
    const closed = ['()', callee, args]
    return [stack, env, ok(closed)]
}

/**
 * Whether a name is bound outside the function being resolved: bound by
 * the names a function frame on the stack holds for after its body, which
 * the body may not use — a function has no frame to capture with yet.
 *
 * @type {(stack: _Stack, word: string) => boolean}
 */
const bound = (stack, word) => {
    for (let s = stack; s !== null; s = s.rest) {
        if ('outer' in s.top && at(word)(s.top.outer) !== null) { return true }
    }
    return false
}

/**
 * The next step of a function's block body: the `const` at `index`, its name
 * checked before its value is entered — as a module's `const` is, so that a
 * statement wrong in both halves answers for the half a reader meets first
 * — or, once the statements are done, the value the body returns.
 *
 * @type {(stack: _Stack, env: _Env, frame: _BodyFrame) => _State}
 */
const bodyRound = (stack, env, frame) => {
    const { statements, index } = frame
    if (index >= statements.length) { return [{ top: frame, rest: stack }, env, ['enter', frame.result]] }
    const [tag, word] = bindable(env)(statements[index].name)
    return tag === 'error'
        ? [stack, env, error(word)]
        : [{ top: { ...frame, word }, rest: stack }, env, ['enter', statements[index].value]]
}

/**
 * Enters a node: a primitive is its value, a reference the binding `env`
 * holds for its name, an access its base under a frame holding the key, a
 * container the first round of a new frame, and a function its body under
 * a frame holding `env` — the body resolved against its own names alone, so
 * a reference to a name bound outside is a capture, refused where it is
 * written, and a name it does not find anywhere is `const not found` as
 * ever.
 *
 * A block body is entered the same way, under a frame that also holds its
 * statements: the parameter is the only name bound when the first of them
 * is resolved, and each binds its own as the module's `const`s do.
 *
 * @type {(stack: _Stack, env: _Env, node: Node) => _State}
 */
const enter = (stack, env, node) => {
    switch (node[0]) {
        case 'primitive': { return [stack, env, ok(node[1])] }
        case 'ref': {
            const [tag, word] = identifierOf(node[1])
            if (tag === 'error') { return [stack, env, error(word)] }
            const ref = at(word)(env)
            if (ref !== null) { return [stack, env, ok(ref)] }
            return [stack, env, error(bound(stack, word) ? capture(node[1]) : constNotFound(node[1]))]
        }
        case '.': { return [{ top: { key: node[2] }, rest: stack }, env, ['enter', node[1]]] }
        case '()': { return callRound(stack, env, { call: node, index: 0, done: null }) }
        case '-': { return [{ top: { neg: true }, rest: stack }, env, ['enter', node[1]]] }
        case '=>': {
            const [tag, word] = identifierOf(node[1])
            if (tag === 'error') { return [stack, env, error(word)] }
            const inner = setReplace(word)(args)(empty)
            const body = node[2]
            return body[0] === 'block'
                ? bodyRound(stack, inner, { outer: env, statements: body[1], index: 0, word: '', done: null, result: body[2] })
                : [{ top: { outer: env }, rest: stack }, inner, ['enter', body]]
        }
        // a block stands only as a function's body, which `'=>'` above
        // enters; the mapping writes one nowhere else
        default: { return round(stack, env, { container: /** @type {Container} */ (node), index: 0, done: null }) }
    }
}

/**
 * A value handed to the frame on top: the next round of a container with
 * the value among its items, an access closed over its base, or a function
 * closed over its body, the names bound outside it in force again.
 *
 * @type {(stack: _Stack, env: _Env, frame: _Frame, value: AstConst) => _State}
 */
const returned = (stack, env, frame, value) => {
    if ('container' in frame) { return round(stack, env, { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }) }
    if ('call' in frame) { return callRound(stack, env, { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }) }
    if ('key' in frame) { return [stack, env, accessClosed(frame.key, value)] }
    if ('neg' in frame) {
        /** @type {AstNeg} */
        const negated = ['-', value]
        return [stack, env, ok(negated)]
    }
    if ('statements' in frame) {
        if (frame.index < frame.statements.length) {
            // the binding lands after the value, keeping the name out of its
            // own initializer's scope, and names entry `index` of this body
            return bodyRound(
                stack,
                extended(env)(frame.word, ['cref', frame.index]),
                { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) })
        }
        /** @type {AstFunction} */
        const withConsts = ['=>', [...toArray(frame.done), value]]
        return [stack, frame.outer, ok(withConsts)]
    }
    /** @type {AstFunction} */
    const fn = ['=>', [value]]
    return [stack, frame.outer, ok(fn)]
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
    let state = [null, env, ['enter', root]]
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
 * The statements of a module, in order: each `import` binds its name to
 * the next argument, each `const` resolves its value against the names
 * bound so far — itself not among them, so a `cref` always names an earlier
 * entry — and then binds its name, and the export is resolved against them
 * all.
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
    for (const statement of imports) {
        const [tag, word] = bindable(env)(statement.name)
        if (tag === 'error') { return error(word) }
        const [read, record] = imported(statement)
        if (read === 'error') { return error(record) }
        env = extended(env)(word, ['aref', modules.length])
        modules = [...modules, record]
    }
    for (const { name, value: node } of consts) {
        // the name first: a statement wrong in both halves answers for the
        // half a reader meets first
        const [tag, word] = bindable(env)(name)
        if (tag === 'error') { return error(word) }
        const [resolved, value] = evaluate(env)(node)
        if (resolved === 'error') { return error(value) }
        env = extended(env)(word, ['cref', body.length])
        body = [...body, value]
    }
    const [resolved, last] = evaluate(env)(exported)
    if (resolved === 'error') { return error(last) }
    // annotated rather than inferred: a bare `[modules, body]` widens to an
    // array, because `readonly string[]` is itself assignable to `AstBody`.
    /** @type {AstModule} */
    const astModule = [modules, [...body, last]]
    return ok(astModule)
}

// The tree of a whole module is too deep a type for `tsc` to unroll
// through `parser`'s return type (TS2589); the rule is widened to `Rule`
// here, and `moduleAt` reads the one symbol the match is.
const parseModule = parser(/** @type {Rule} */ (djsModule), mappings)

/**
 * Reads the token list as a FunctionalScript module: `import` statements, then
 * `const` statements, then one `export default`, each ended by `;`.
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
    return foldModule(moduleAt(tree))
}
