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
 * the whole module. Each `import` and `const` binds its name *before* its
 * value is resolved, so `const a = a` names the constant being defined,
 * and the export is the module's last value.
 *
 * The grammar sees symbols and the fold sees text, which is the line that
 * decides where a check belongs: every check that has to read a *word* is
 * the fold's — a reference to a name nothing binds, a name bound twice by
 * `import` or `const`, which share one map, and a bare or string
 * `__proto__` key, which JavaScript reads as an instruction to replace the
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
 * @import { Primitive } from '../../djs/types.ts'
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { AstArray, AstConst, AstModule, AstModuleRef, AstObject } from '../ast/types.ts'
 * @import { Const, Container, Entry, Import, Module, Node, Out, ParseError } from './types.ts'
 * @import { Items, Member, Value } from './grammar/types.ts'
 * @import { key, primitive } from './grammar/module.f.mjs'
 * @import { _Env, _Frame, _Leaf, _ListNode, _OptionalList, _Stack, _State, _TokenStream } from './private.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { at, empty, setReplace } from '../../types/ordered_map/module.f.mjs'
import { assert } from '../../asserts/module.f.mjs'
import { symbolAt, unmapped } from '../../ebnf/ast/module.f.mjs'
import { mapping, parser } from '../../ebnf/ll1/module.f.mjs'
import {
    constStatement, djsModule, exportStatement, importStatement, member, members, symbolOf, value, values,
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
 * The word an identifier token spells. A framing keyword is an identifier
 * too, arriving as the same `id` token.
 *
 * @type {(t: DjsTokenWithMetadata) => string}
 */
const nameOf = ({ token }) => {
    assert(token.kind === 'id')
    return token.value
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
        case '-Infinity': { return -Infinity }
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
 * The items of a list node, `item t [ ',' t [ items ] ]`: the item, then
 * the items the nested list's mapping already returned — so a list of any
 * length costs one step at each of its nodes, and the tree, as deep as the
 * list is long, is never walked.
 *
 * @type {<T>(itemAt: (node: _Leaf) => T, itemsAt: (node: _Leaf) => List<T>) => (node: _ListNode) => List<T>}
 */
const listOf = (itemAt, itemsAt) => {
    const rest = optionalItems(itemsAt)
    return ([item, , more]) => {
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
 * A value is the node its branch made: a primitive converted from its
 * token, a reference by its token, and a container of the items its list
 * returned — `[ open t [ items ] close ]`, the list at the third position.
 *
 * @type {(node: Children<Value, DjsTokenWithMetadata, Out>) => Meta<Out>}
 */
const toNode = ([tag, branch]) => {
    switch (tag) {
        case 'primitive': { return symbol({ id: 'value', node: ['primitive', primitiveOf(unmapped(branch))] }) }
        case 'ref': { return symbol({ id: 'value', node: ['ref', tokenAt(unmapped(branch)[1])] }) }
        case 'array': {
            return symbol({ id: 'value', node: ['array', toArray(valueItems(unmapped(branch)[2]))] })
        }
        case 'object': {
            return symbol({ id: 'value', node: ['object', toArray(memberItems(unmapped(branch)[2]))] })
        }
    }
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

/** @type {(node: Children<typeof importStatement, DjsTokenWithMetadata, Out>) => Meta<Out>} */
const toImport = ([, , name, , , , module]) =>
    symbol({ id: 'import', statement: { name: tokenAt(unmapped(name)[1]), module: textOf(tokenAt(module)) } })

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
    map(values, toValues),
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
 * A container of the values its items resolved to: an array, or an object
 * with a property per member, in the order the members are written — the
 * order JavaScript gives the same literal, which is the order the graph a
 * module denotes has, so it is not the parser's to change. A repeated key
 * keeps its first position and takes its last value, as it does there: the
 * spread copies the properties so far, and the member then writes over its
 * own, which leaves a property where it first stood.
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
    const empty = {}
    return members.reduce((object, { name }, index) => ({ ...object, [name]: done[index] }), empty)
}

/**
 * The next item of a container, its key checked first, or the container
 * closed when none is left.
 *
 * @type {(stack: _Stack, frame: _Frame) => _State}
 */
const round = (stack, frame) => {
    const { container, index, done } = frame
    if (index >= container[1].length) { return [stack, ok(close(container, toArray(done)))] }
    const rejected = badKey(container, index)
    return rejected === null
        ? [{ top: frame, rest: stack }, ['enter', itemAt(container, index)]]
        : [stack, error(rejected)]
}

/**
 * Enters a node: a primitive is its value, a reference the binding `env`
 * holds for its name, and a container the first round of a new frame.
 *
 * @type {(env: _Env, stack: _Stack, node: Node) => _State}
 */
const enter = (env, stack, node) => {
    const [tag, payload] = node
    switch (tag) {
        case 'primitive': { return [stack, ok(payload)] }
        case 'ref': {
            const ref = at(nameOf(payload))(env)
            return [stack, ref === null ? error(constNotFound(payload)) : ok(ref)]
        }
        default: { return round(stack, { container: node, index: 0, done: null }) }
    }
}

/**
 * The value a node denotes under `env`, or the first error met in document
 * order: a reference to a name `env` does not bind, or a plain `__proto__`
 * key.
 *
 * Over an explicit stack: a frame per container being built, its items
 * resolved in order, so that a value nested as deep as the input allows
 * costs no call stack.
 *
 * @type {(env: _Env) => (root: Node) => Result<AstConst, ParseError>}
 */
const evaluate = env => root => {
    /** @type {_State} */
    let state = [null, ['enter', root]]
    while (true) {
        const [stack, [tag, payload]] = state
        if (tag === 'enter') {
            state = enter(env, stack, payload)
        } else if (tag === 'error') {
            return error(payload)
        } else if (stack === null) {
            return ok(payload)
        } else {
            const { top, rest } = stack
            state = round(rest, { ...top, index: top.index + 1, done: concat(top.done)([payload]) })
        }
    }
}

/**
 * Binds a name to a reference, refusing one already bound. `import` and
 * `const` share the one map, so a name taken by either is taken for both.
 *
 * @type {(env: _Env) => (name: DjsTokenWithMetadata, ref: AstModuleRef) => Result<_Env, ParseError>}
 */
const bind = env => (name, ref) => {
    const word = nameOf(name)
    return at(word)(env) !== null
        ? error(duplicateId(name))
        : ok(setReplace(word)(ref)(env))
}

/**
 * The statements of a module, in order: each `import` binds its name to
 * the next argument, each `const` binds its name and then resolves its
 * value against the names bound so far, itself included, and the export
 * is resolved against them all.
 *
 * @type {(module: Module) => Result<AstModule, ParseError>}
 */
const foldModule = ({ imports, consts, exported }) => {
    /** @type {_Env} */
    let env = empty
    /** @type {readonly string[]} */
    let modules = []
    /** @type {readonly AstConst[]} */
    let body = []
    for (const { name, module } of imports) {
        const [tag, bound] = bind(env)(name, ['aref', modules.length])
        if (tag === 'error') { return error(bound) }
        env = bound
        modules = [...modules, module]
    }
    for (const { name, value: node } of consts) {
        const [tag, bound] = bind(env)(name, ['cref', body.length])
        if (tag === 'error') { return error(bound) }
        env = bound
        const [resolved, value] = evaluate(env)(node)
        if (resolved === 'error') { return error(value) }
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
