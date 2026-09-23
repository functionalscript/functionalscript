/**
 * The DJS module parser: the fold that resolves the names of the module of
 * nodes `./reader` builds into an `AstModule`, and {@link parseFromTokens},
 * the parser over a token stream — the third arrow, the first two being
 * the reader's:
 *
 * ```text
 * DjsToken stream ==the module grammar, one symbol per token==> tree
 *                 ==the rewrite set: a node per value, a record per statement==> module
 *                 ==the fold: names bound and resolved, keys checked==> AstModule
 * ```
 *
 * The names are resolved where the statements are read, after the grammar
 * has matched the whole module. Each `import` binds its name, each `const`
 * resolves its value against the names bound so far and then binds its own
 * — so `const a = a` is `const not found`, as it is a reference before its
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
 * Every walk is a loop over an explicit stack: the resolution walks a
 * value over a stack of frames, so nesting depth and width stay the
 * input's.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { AstAccess, AstArgs, AstArray, AstBinary, AstBitnot, AstCall, AstConditional, AstConst, AstFrameRef, AstFunction, AstNeg, AstImport, AstMember, AstModule, AstModuleRef, AstObject, AstParameter } from '../ast/types.ts'
 * @import { ParseError } from './types.ts'
 * @import { Container, Entry, Import, Module, Node, Parameters } from './reader/types.ts'
 * @import { _AccessFrame, _BodyFrame, _CallFrame, _ConditionalFrame, _ContainerFrame, _Env, _Frame, _Ref, _Scope, _Stack, _State } from './private.ts'
 */

import { error, mapOk, ok, okThen } from '../../types/result/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { at, empty, setReplace } from '../../types/ordered_map/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { keywords } from '../../js/keywords/module.f.mjs'
import { prohibitedCalls, prototypeNames } from '../../js/prototype/module.f.mjs'
import { _nameOf, _textOf, readFromTokens } from './reader/module.f.mjs'

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

/**
 * An arrow after a group that is no parameter list, at the arrow: the
 * grammar reads `(a.b) => 1` as a value and then `=>`, JavaScript's cover
 * grammar at one name's width, and a name followed by anything is no
 * parameter — an access, an operator, a call. Default values and
 * destructuring are not admitted either, and are refused by the grammar
 * before this: `(a = 1) => 1` at the `=`, `([a]) => 1` at the `=>`.
 */
const invalidParameters = foldError('invalid parameter list')

/** The arguments of the function whose body is being resolved. @type {AstArgs} */
const args = ['args']

/** Named parameter `i` of the function whose body is being resolved: the `i`-th argument. @type {(i: number) => AstParameter} */
const parameter = i => ['.', args, i]

/** @type {ReadonlySet<string>} */
const keywordSet = new Set(keywords)

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
    const word = _nameOf(name)
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
    if (_nameOf(key) !== 'type') { return error(unknownAttribute(key)) }
    if (_textOf(value) !== 'json') { return error(unknownType(value)) }
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
        default: { return _nameOf(t) }
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

/**
 * Whether two references name one binding: the same tuple, position by
 * position — a parameter's two fixed positions are the one `args` and its
 * index, so two parameters differ at the third.
 *
 * @type {(a: _Ref, b: _Ref) => boolean}
 */
const sameRef = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

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
 * The names a function's body begins with, and how many parameters it
 * declares: the rest parameter bound to the arguments array, or each
 * named parameter bound to its position of that array, {@link parameter},
 * and nothing else of its own — a name bound outside is a capture,
 * {@link resolve}. A name is refused as a `const`'s is, {@link bindable}:
 * a reserved word, and a name the list already holds, `(a, a) => 1` being
 * a `duplicate id` at the second `a` as JavaScript refuses it.
 *
 * The count is what the function's `length` reads as, `0` for a rest
 * parameter as for none and `n` for `n` names whether the body reads them
 * or not. An empty parameter list binds nothing, so a body under it
 * starts from no names of its own: the arguments are unreachable, having
 * no name, and every other word is a capture or `const not found` exactly
 * as it is under a parameter that does not spell it — and nothing
 * downstream tells `()` from `(...a)`, the two counting the same.
 *
 * A group the grammar read an arrow after is no parameter list, and is
 * refused at the arrow, {@link invalidParameters}.
 *
 * @type {(parameters: Parameters) => Result<readonly [_Env, number], ParseError>}
 */
const functionScope = parameters => {
    switch (parameters[0]) {
        case 'rest': {
            const [tag, word] = identifierOf(parameters[1])
            return tag === 'error' ? error(word) : ok([setReplace(word)(args)(empty), 0])
        }
        case 'names': {
            const names = parameters[1]
            return mapOk(
                /** @type {(env: _Env) => readonly [_Env, number]} */
                (env => [env, names.length]),
            )(names.reduce(
                /** @type {(acc: Result<_Env, ParseError>, name: DjsTokenWithMetadata, i: number) => Result<_Env, ParseError>} */
                ((acc, name, i) => okThen(
                    /** @type {(env: _Env) => Result<_Env, ParseError>} */
                    (env => mapOk(
                        /** @type {(word: string) => _Env} */
                        (word => extended(env)(word, parameter(i))),
                    )(bindable(env)(name))),
                )(acc)),
                /** @type {Result<_Env, ParseError>} */ (ok(empty))))
        }
        case 'group': { return error(invalidParameters(parameters[1])) }
    }
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
 * `scope`, {@link functionScope}. A name no scope binds is `const not
 * found`.
 *
 * A block body is entered the same way, under a frame that also holds its
 * statements: the parameters are the only names bound when the first of
 * them is resolved — none is, where the list is empty — and each binds
 * its own as the module's `const`s do.
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
            const [tag, bound] = functionScope(node[1])
            if (tag === 'error') { return [stack, scope, error(bound)] }
            const [names, parameters] = bound
            /** @type {_Scope} */
            const inner = { names, captures: [], read: [], outer: scope, parameters }
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
 * A function closed over its body, resolved in `scope`: its parameter
 * count, the scope around it in force again — with every capture the body
 * took on the way — and the body's own captures, where there are any, the
 * function's fourth element.
 *
 * @type {(stack: _Stack, scope: _Scope, body: readonly AstConst[]) => _State}
 */
const closed = (stack, scope, body) => {
    const outer = assertNotNullish(scope.outer, ['a function body with no scope around it', body])
    /** @type {AstFunction} */
    const fn = scope.captures.length === 0 ? ['=>', scope.parameters, body] : ['=>', scope.parameters, body, scope.captures]
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
    let state = [null, { names: env, captures: [], read: [], outer: null, parameters: 0 }, ['enter', root]]
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

/** The environment with a word bound to a reference, its two questions already answered. @type {(env: _Env) => (word: string, ref: AstModuleRef | AstArgs | AstParameter) => _Env} */
const extended = env => (word, ref) => setReplace(word)(ref)(env)

/**
 * The statements of a module, in order: each `import` binds its name to
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
        const [tag, word] = bindable(env)(statement.name)
        if (tag === 'error') { return error(word) }
        const [read, record] = imported(statement)
        if (read === 'error') { return error(record) }
        env = extended(env)(word, ['aref', modules.length])
        modules = [...modules, record]
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

/**
 * Reads the token list as a FunctionalScript module: `import` statements, then
 * `const` and `export const` statements, with an optional final `export default`.
 * At least one export is required; every statement ends with `;`.
 *
 * This is the only language the parser reads. A JSON document is data, not a
 * module, and `fjs/media/json` is its reader
 * ([spec: JSON input](../../../spec/README.md#json-input)).
 *
 * The grammar it accepts is written down in `./grammar` and read by
 * `./reader`, and what the grammar accepts and this refuses is the fold's:
 * a name unbound or bound twice, and a plain `__proto__` key.
 *
 * @type {(tokenList: List<DjsTokenWithMetadata>) => Result<AstModule, ParseError>}
 */
export const parseFromTokens = tokenList => {
    const [tag, module] = readFromTokens(tokenList)
    return tag === 'error' ? error(module) : foldModule(module)
}
