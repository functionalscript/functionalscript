/**
 * The module reader: {@link parseFromTokens}, the syntax tree of
 * `./syntax` with its names resolved — the fold that makes the AST of a
 * module record.
 *
 * ```text
 * DjsToken stream ==./syntax: the grammar, then the rewrite set==> module
 *                 ==the fold: names bound and resolved, keys checked==> AstModule
 * ```
 *
 * Each `import` binds its local names, each `const` resolves its value
 * against the names bound so far and then binds its own — so `const a = a`
 * is `const not found`, as it is a reference before its declaration in
 * JavaScript. A `const` or a fixed parameter of a binding pattern binds
 * every name in it, each to an entry reading its part of the value,
 * {@link lowered}: the fold writes the reads the pattern is sugar for, as
 * it writes a guard's conditional, and no node is added to the AST for it.
 * A parameter's reads are the first entries of the function's body, the
 * argument their source, {@link functionScope}. Export names select
 * those bindings into the module result, with an optional final default
 * expression.
 *
 * The grammar sees symbols and the fold sees text, which is the line that
 * decides where a check belongs: every check that has to read a *word* is
 * the fold's — a reference to a name nothing binds, a name bound twice by
 * `import` or `const`, which share one map, a JavaScript keyword bound or
 * referenced, since the tokenizer hands every keyword over as an
 * identifier and a key or the name after `.` may be one, a reserved global
 * — `Number` and `String`, spelled only as their conversions,
 * {@link conversion}, and `Object`, only as the namespace of `Object.is`,
 * {@link objectIsRead} — bound or referenced anywhere else, and a bare or
 * string `__proto__` key, which JavaScript reads as an instruction to
 * replace the prototype; the computed spelling `{ ["__proto__"]: v }` and
 * the shorthand `{ __proto__ }` denote an ordinary property and are
 * accepted. So is every check that has to read a token's *line*: trivia is
 * not in the stream, and whether a newline stood before a token is a fact
 * the token carries, so a statement written without its `;` ends where
 * JavaScript inserts one, and whether the next statement began a line is
 * the fold's to ask of its first token,
 * {@link unterminated}, the grammar having read the `;` as optional and
 * looked no further; and the places JavaScript forbids a line break,
 * before `=>` and after `return` or `throw`, are the fold's the same way. The error
 * reported is the first met in document order, and a match that fails
 * builds no module: a malformed suffix is found before any name is
 * resolved. `./README.md` holds the argument.
 *
 * The `entry` helper is the fold's to recognize, {@link entryFunction}: the
 * one function whose body names a property at run time, matched whole on
 * the syntax tree with its names resolved as every other body's are, and
 * the one place `Object` stands but `Object.is` — outside the two the fold
 * refuses the word, as it refuses every reserved global.
 *
 * `Object.is` is a value, the AST's `['Object.is']`, in every spelling
 * JavaScript reads it in, {@link objectIsRead}; and a destructuring is
 * sugar, so an object pattern over `Object` reads each of its keys as
 * that read, `const { is } = Object` being `const is = Object.is`,
 * {@link namespaceOf}.
 *
 * A guard, `if (c) block`, is the fold's to shape as well as to check: it
 * is syntactic sugar, and the fold writes what it is sugar for. The
 * guard's block and the statements after it are each the body of a
 * parameterless function called where it stands — the call the lowering
 * inlines, {@link bodyRound} — and the guard is the conditional of the
 * two, `c ? (() => { …block… })() : (() => { …rest… })()`, so a `const` of
 * either arm is the arm's alone and the graph is the one that spelling
 * has ([spec: functions](../../../spec/README.md#functions)). No node is
 * added to the AST for it. A loop, `let r = init; while (c) block`, is
 * the fold's the same way: the two statements are one entry, the call of
 * the function `r => c ? (() => { …block…; return self(next); })() : r`
 * with `init`, the block the body of a parameterless function as a
 * guard's arm is, {@link loopRound}, and the variable names the call from
 * the loop on ([spec: loops](../../../spec/README.md#loops)).
 *
 * The resolution walks a value over an explicit stack of frames, so
 * nesting depth stays the input's.
 *
 * {@link errorLocation} is `ParseError`'s renderer, beside the reader that
 * reports one, so a change to what the type carries and to how it is
 * printed is made in one module.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { AstAccess, AstArray, AstBinary, AstBitnot, AstNot, AstTypeof, AstInstanceOf, AstNumber, AstString, AstKey, AstSelf, AstCall, AstConditional, AstConst, AstEntryFunction, AstFrameRef, AstEntry, AstFunction, AstItem, AstNeg, AstObjectIs, AstImport, AstMember, AstModule, AstModuleRef, AstObject, AstRest, AstSpread, AstStep, AstThrow } from '../ast/types.ts'
 * @import { ParseError } from './types.ts'
 * @import { BindingElement, BindingProperty, BindingTarget, Block, Chain, ComputedKey, ConstantMember, Container, Entry, If, Import, Item, Key, Module, Node, ParameterList, Statement, Step, ValueStatement, While } from './syntax/types.ts'
 * @import { _AccessFrame, _BodyFrame, _Bound, _CallFrame, _ChainFrame, _ChainPart, _ConditionalFrame, _IndexFrame, _ContainerFrame, _Env, _Frame, _GuardFrame, _LoopBodyFrame, _Lowered, _Parameter, _Pending, _PendingStack, _Plan, _Read, _Ref, _Scope, _Source, _Stack, _State } from './private.ts'
 */

import { error, mapOk, ok } from '../../types/result/module.f.js'
import { concat, reverse, toArray } from '../../types/list/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { at, empty, setReplace } from '../../types/ordered_map/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { maxLength } from '../../types/function/length/module.f.mjs'
import { isKeyword, isReservedGlobal } from '../../js/keywords/module.f.js'
import { prohibitedCalls, prototypeNames } from '../../js/prototype/module.f.js'
import { nameOf, parseSyntax, textOf } from './syntax/module.f.mjs'
import { isBinary } from '../ast/module.f.mjs'

// -- resolving the names ------------------------------------------------------

/**
 * The key of `{ __proto__: v }` and `{ "__proto__": v }`. JavaScript reads
 * both as an instruction to replace the object's prototype instead of as a
 * property, so FunctionalScript rejects them and accepts only the computed
 * spelling `{ ["__proto__"]: v }` and the shorthand `{ __proto__ }`, which
 * denote an ordinary property, as they do in JavaScript.
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
 * A `let` the statement after it is not a `while`, at the `let`: the two
 * are one loop, and the language has no `let` on its own
 * ([spec: loops](../../../spec/README.md#loops)).
 */
const letWithoutWhile = foldError('let without while')

/** A `while` no `let` stands before, at the `while`, for the same reason. */
const whileWithoutLet = foldError('while without let')

/** An assignment to a name that is not the loop's variable, at the name: the one name a loop's block may rebind. */
const notTheLoopVariable = foldError('not the loop variable')

/**
 * A `const` of the loop's variable in the loop's block, at the name: in
 * JavaScript the block's own binding, which the loop never sees, where
 * this fold would read it as the assignment the block's end continues
 * with — so it is refused rather than read another way.
 */
const loopVariableShadowed = foldError('loop variable shadowed')

/**
 * A read of a loop's variable from a function nested in the loop, at the
 * reference: JavaScript's closure sees the variable's last value, where the
 * function's capture holds the value of the round it was made in, so the
 * program is refused rather than read another way.
 */
const loopVariableCaptured = foldError('loop variable captured')

/**
 * The word the function a loop lowers to is bound to in its own scope,
 * which its block reads it back as to call it: one no identifier can
 * spell, so that no word of the source resolves to it.
 */
const loopSelf = '\0loop'

/**
 * A parameter list whose first parameter is no binding target — no name
 * and no pattern — at the `(` that opened it: `(1) => 2`, `(a.b) => 1`,
 * `((a)) => 1`, JavaScript's own early error, by its own name. The grammar
 * admits the value there so that one symbol can decide between a list and
 * a group (`afterValue` in `./grammar/module.f.mjs`), and this is the
 * check that decision left. A value that is no target inside the head's
 * pattern, `([(a)]) => 1`, is {@link invalidTarget} where it stands, as in
 * a `const`.
 */
const malformedParameters = foldError('malformed parameter list')

/**
 * A value where a binding pattern wants a target, at the token it begins
 * with — `const [1] = a;`, `const { a: b.c } = o;`, `const [(a)] = x;`,
 * the last a group, which JavaScript admits in an assignment pattern and
 * refuses in a binding one — by JavaScript's own name for the error.
 */
const invalidTarget = foldError('invalid destructuring target')

/**
 * A rest element or property in a binding pattern, `[a, ...r]` or
 * `{ a, ...r }`, at its `...`: JavaScript's, and not read yet
 * ([destructuring](../../../spec/todo/2450-destructuring.md)), so refused
 * by name rather than read in part.
 */
const restTarget = foldError('rest element not supported')

/**
 * A computed key in a binding pattern that is no constant, `{ [k]: a }`,
 * at the token the key begins with. A string or a number literal alone in
 * the brackets, `{ ["a"]: t }` or `{ [3]: t }`, is the constant key an
 * access admits in brackets and never reaches here; the rest is not read
 * yet, the conversion `Number(i)` an access admits included — a body's
 * statement is resolved as one value, and the key would be a second value
 * to resolve inside the statement
 * ([destructuring](../../../spec/todo/2450-destructuring.md)).
 */
const computedPatternKey = foldError('computed key in a binding pattern not supported')

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

/**
 * A keyword where JavaScript wants an identifier, at the word — or a
 * reserved global, `Number` or `String`, bound or read anywhere but as the
 * callee of the conversion, {@link conversion}, or `Object` anywhere but
 * as the namespace of `Object.is`, {@link objectIsRead}: never a module's
 * to bind, under
 * [spec: global names](../../../spec/todo/2365-global-names.md)' rule, and
 * no value, so `Number.isFinite`, `Object.keys` and a bare `Number` are
 * refused at the word as `typeof.x` would be.
 */
const reservedWord = foldError('reserved word')

/**
 * The call of `Number` or `String` with more than one argument, or a spread,
 * at the word: `Number(a, b)` and `Number(...a)`, JavaScript's and not recognized
 * yet, for want of a representation
 * ([spec: number conversion](../../../spec/README.md#number-conversion)):
 * `Number(a, b)` is the comma's `(a, b, Number(a))`, which the
 * FunctionalScript writer cannot spell until the comma operator lands, and
 * `Number(...a)` converts the first value a spread yields, which no node
 * expresses while a call's arity is the callee's to split. Refused by name
 * rather than answered wrongly; `Number()` is `0`, and is read as the
 * literal, {@link conversion}, as `String()` is the empty string.
 *
 * @type {(name: 'Number' | 'String') => (token: DjsTokenWithMetadata) => ParseError}
 */
const conversionArity = name => foldError(`${name} takes one argument`)

/**
 * A token on the wrong side of a line break, at that token: the first
 * token of a statement on the line of the statement before it, written
 * without its `;` — the error the grammar reported there when the `;` was
 * required, and the one JavaScript reports, which inserts a `;` before a
 * token only where a newline does
 * ([spec: module structure](../../../spec/README.md#module-structure)) —
 * and the tokens JavaScript forbids a newline before, an `=>` and the
 * value after `return` or `throw`
 * ([spec: line terminators](../../../spec/README.md#whitespace-and-line-terminators)).
 */
const unexpectedToken = foldError('unexpected token')

/**
 * A module that neither throws nor exports a name, at its last `export`:
 * every exported `const` was a pattern binding no name, `export const {} = o;`,
 * and no `export default` followed. A module that does not throw exports at
 * least one name ([spec: exports](../../../spec/README.md#exporting-a-value)),
 * which the grammar asked of the `export` keyword while a `const` always
 * bound one.
 */
const noExport = foldError('module exports nothing')

/**
 * The entry a `throw` statement makes of its value: a body's last, in a
 * function or the module, in place of what it would return
 * ([spec: functions](../../../spec/README.md#functions)).
 *
 * @type {(value: AstConst) => AstThrow}
 */
const thrown = value => ['throw', value]

/**
 * Whether a `return` or `throw`'s value is refused at its first token:
 * JavaScript has `[no LineTerminator here]` after both keywords, so a value
 * beginning a line would end the statement there — `return` returning
 * `undefined`, `throw` a syntax error — and is refused rather than read
 * another way.
 *
 * @type {(statement: ValueStatement) => boolean}
 */
const brokenLine = statement => statement.first.newline

/**
 * Whether `next` is refused at its first token: `previous` ended without
 * its `;`, and `next` begins on the same line. Nothing before the first
 * statement, and a `}` or the end of input after the last, so neither is
 * asked; nor is a guard, which ends at its `}` and takes no `;`, so the
 * statement after one may share its line, as in JavaScript.
 *
 * @type {(previous: Statement | If | While | null, next: Statement | If | While) => boolean}
 */
const unterminated = (previous, next) => previous !== null && 'semicolon' in previous && !previous.semicolon && !next.start.newline

/** A fixed parameter past the language's limit on a function's `length`, at the first one past it. */
const tooManyParameters = foldError(`more than ${maxLength} fixed parameters`)

/** The rest array after the fixed parameters of the function whose body is being resolved. @type {AstRest} */
const restBinding = ['rest']

/**
 * The word an identifier token spells where JavaScript wants an identifier
 * — a name bound or referenced — refusing every keyword: the tokenizer
 * demotes them all to `id`, so that a key or the name after `.` may be one,
 * and here is where the distinction is made. `const if = 1;` is a syntax
 * error in JavaScript, so it is an error here. A reserved global is refused
 * the same way, {@link reservedWord}: `Array`, `Number`, `Object` and
 * `String` name no binding and no value, and the places each stands are
 * read before the word reaches here — `instanceof`'s right operand, which
 * the fold checks for the word itself, the conversion's callee,
 * {@link conversion}, and the namespace of `Object.is`,
 * {@link objectIsRead}, and of the `entry` helper, {@link entryFunction}.
 *
 * @type {(name: DjsTokenWithMetadata) => Result<string, ParseError>}
 */
const identifierOf = name => {
    const word = nameOf(name)
    return isKeyword(word) || isReservedGlobal(word) ? error(reservedWord(name)) : ok(word)
}

/**
 * An `instanceof` whose right operand is not a reference to `Array`, at
 * the operator: the language admits that one constructor, and reads the
 * word, not a value — so an access, a literal or a parenthesized value
 * other than the bare reference is refused here, whatever it would be
 * in JavaScript.
 */
const instanceofRight = foldError('the right operand of instanceof must be Array')

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
 * Exported for the writer, as {@link _prohibitedNames} is.
 *
 * @type {ReadonlySet<string>}
 */
export const _prohibitedCallNames = new Set(prohibitedCalls)

/** What an access's key token names: a name's word, the string's text, or the number. @type {(t: DjsTokenWithMetadata) => string | number} */
const keyNamed = t => {
    const { token } = t
    switch (token.kind) {
        case 'string': { return token.value }
        case 'number': { return Number(token.value.replaceAll('_', '')) }
        default: { return nameOf(t) }
    }
}

/**
 * An access closed over its base and its constant key: the AST's
 * `['.', base, key]`, or the refusal of its key — a name of the prototype
 * chain where the access is read, and a member function a module may not
 * call where it is a call's callee, `method`. The two rules are
 * `fjs/js/prototype`'s two lists, and the access's shape is the same
 * either way: the lowering makes the callee access a method call,
 * `['.', a, 'b', ['|()', args]]`.
 *
 * @type {(key: DjsTokenWithMetadata, method: boolean, base: AstConst) => Result<AstConst, ParseError>}
 */
const accessClosed = (key, method, base) => mapOk(
    /** @type {(named: string | number) => AstConst} */
    (named => ['.', base, named]),
)(checkedKey(key, method))

/**
 * A key computed at run time that is no conversion, at the token it begins
 * with: `a[i]`, `a[-1]`, `a[NaN]`. An index is a constant — a string or a
 * number literal — or `Number(i)`, the conversion
 * ([spec: property access](../../../spec/README.md#property-access)); a key
 * of any type is read by the `entry` helper, and a negative or a special
 * number is written as the string it names, `a["-1"]`.
 */
const computedKey = foldError('computed key is not Number(...)')

/**
 * Whether a computed key is the conversion: a call of the word `Number`,
 * whatever its arguments, which the conversion itself judges when entered,
 * {@link conversion} — so `a[Number()]` is `a[0]`, and `a[Number(1, 2)]`
 * is refused as `Number(1, 2)` is anywhere.
 *
 * @type {(node: Node) => boolean}
 */
const isConversion = node => node[0] === '()' && node[1][0] === 'ref' && nameOf(node[1][1]) === 'Number'

/**
 * A computed key entered under `frame`, which receives its value — the
 * access whose base it follows, {@link _IndexFrame}, or a chain, which
 * takes the key among its parts' values — or its refusal, at the token it
 * begins with, {@link computedKey}. It is entered after the base, and after
 * every part of a chain written before it, as JavaScript evaluates it.
 *
 * @type {(stack: _Stack, scope: _Scope, key: ComputedKey, frame: _IndexFrame | _ChainFrame) => _State}
 */
const keyEntered = (stack, scope, [, node, first], frame) => isConversion(node)
    ? [{ top: frame, rest: stack }, scope, ['enter', node]]
    : [stack, scope, error(computedKey(first))]

/**
 * A key's name, or its refusal: a name of the prototype chain where the
 * key is read, and a member function a module may not call where it is
 * called, `method` — the two rules of `fjs/js/prototype`'s two lists.
 *
 * @type {(key: DjsTokenWithMetadata, method: boolean) => Result<string | number, ParseError>}
 */
const checkedKey = (key, method) => {
    const named = keyNamed(key)
    if (typeof named === 'string') {
        if (method && _prohibitedCallNames.has(named)) { return error(prohibitedCall(key)) }
        if (!method && _prohibitedNames.has(named)) { return error(prohibitedKey(key)) }
    }
    return ok(named)
}

/** The pending stack with one more item on top, {@link planned}'s. @type {(stack: _PendingStack, item: _Pending) => _PendingStack} */
const pushed = (stack, item) => ({ top: item, rest: stack })

/**
 * A binding target checked, as the plan the lowering follows,
 * {@link lowered}: each name is checked as a `const`'s is, `check` —
 * {@link bindable} for a module's, {@link bodyBindable} for a body's — and
 * refused as `duplicate id` where the pattern itself has bound the word
 * already, `const { a, b: a } = o;` being a syntax error in JavaScript;
 * each key as an access's is, {@link checkedKey}, since an access is what
 * the lowering makes of it; and what the language does not read is
 * refused by name — a value that is no target, a rest element and a
 * computed key. An empty pattern is admitted: it binds nothing and keeps
 * its failure, `[]` as the spread of its source alone, `{}` as one read of
 * its source, its `length`, the one name every kind of value may own —
 * the read that fails on `null` and `undefined` as `RequireObjectCoercible`
 * fails, and whose value is no observation
 * ([spec: destructuring](../../../spec/README.md#destructuring)).
 *
 * One walk over an explicit stack of what is pending, {@link _Pending}, in
 * document order — an element or a property is judged where it is read,
 * so the first refusal in document order is the one reported, a property's
 * key before its target and a name before the names after it — so a
 * pattern nested as deep as the input allows costs no call stack, as a
 * value's resolution costs none. The reads and the names are collected as
 * lists and the words bound so far as an environment, so a pattern as wide
 * as the input allows costs its width and not its square.
 *
 * An object pattern over the `Object` namespace, `namespace` its word,
 * {@link namespaceOf}, reads no source: the namespace is no value, and
 * each of its properties reads the member its key names, the static
 * function itself, {@link objectMember}, as the access `Object.is` does —
 * so `const { is } = Object` makes the one entry `const is = Object.is`
 * makes, and a key the namespace does not admit is refused at the word,
 * as `Object.keys` is.
 *
 * @type {(check: (name: DjsTokenWithMetadata) => Result<string, ParseError>) => (target: BindingTarget, namespace: DjsTokenWithMetadata | null) => Result<_Plan, ParseError>}
 */
const planned = check => (target, namespace) => {
    /** @type {_PendingStack} */
    let pending = namespace === null || target[0] !== 'object'
        ? pushed(null, { target, source: null })
        : properties(null, target[2], namespace)
    /** The reads so far, the last first. @type {List<_Read>} */
    let reads = null
    /** The names so far, the last first, each with its read's position. @type {List<readonly [DjsTokenWithMetadata, number]>} */
    let names = null
    /** The words the pattern has bound so far. @type {_Env} */
    let seen = empty
    let count = 0
    while (pending !== null) {
        /** @type {_Pending} */
        const item = pending.top
        pending = pending.rest
        if ('property' in item) {
            const { property, parent } = item
            if (property instanceof Array) { return error(restTarget(property[1])) }
            const { key, target: element } = property
            if (key instanceof Array) { return error(computedPatternKey(key[2])) }
            const [tag, named] = checkedKey(key, false)
            if (tag === 'error') { return error(named) }
            const [found, source] = propertySource(parent, named)
            if (found === 'error') { return error(source) }
            pending = pushed(pending, { target: element, source })
        } else if ('element' in item) {
            const { element, source } = item
            if (element[0] === '...') { return error(restTarget(element[1])) }
            pending = pushed(pending, { target: element, source })
        } else {
            const { target: t, source } = item
            switch (t[0]) {
                case 'invalid': { return error(invalidTarget(t[1])) }
                case 'name': {
                    const [tag, word] = check(t[1])
                    if (tag === 'error') { return error(word) }
                    if (at(word)(seen) !== null) { return error(duplicateId(t[1])) }
                    seen = extended(seen)(word, ['cref', count])
                    reads = { first: { source, spread: false }, tail: reads }
                    names = { first: [t[1], count], tail: names }
                    count += 1
                    break
                }
                case 'array': {
                    const parent = count
                    reads = { first: { source, spread: true }, tail: reads }
                    count += 1
                    pending = t[2].reduceRight(
                        /** @type {(after: _PendingStack, element: BindingElement, i: number) => _PendingStack} */
                        ((after, element, i) => pushed(after, { element, source: [parent, i] })),
                        pending)
                    break
                }
                case 'object': {
                    const parent = count
                    reads = { first: { source, spread: false }, tail: reads }
                    count += 1
                    if (t[2].length === 0) {
                        // the empty pattern's one read, binding nothing
                        reads = { first: { source: [parent, 'length'], spread: false }, tail: reads }
                        count += 1
                    }
                    pending = properties(pending, t[2], parent)
                    break
                }
            }
        }
    }
    return ok({ reads: toArray(reverse(reads)), names: toArray(reverse(names)) })
}

/**
 * Where a property of an object pattern reads from: the key of the entry
 * its pattern's source is, or, over the `Object` namespace, the member the
 * key names, {@link objectMember} — a key the namespace does not admit
 * refused at the word, as `Object.keys` is.
 *
 * @type {(parent: number | DjsTokenWithMetadata, named: string | number) => Result<_Source, ParseError>}
 */
const propertySource = (parent, named) => {
    if (typeof parent === 'number') { return ok([parent, named]) }
    const member = objectMember(named)
    return member === null ? error(reservedWord(parent)) : ok(member)
}

/**
 * The pending stack with an object pattern's properties on top, the first
 * written first, each with the entry its source is read from — or the
 * namespace's word, {@link planned}.
 *
 * @type {(pending: _PendingStack, list: readonly BindingProperty[], parent: number | DjsTokenWithMetadata) => _PendingStack}
 */
const properties = (pending, list, parent) => list.reduceRight(
    /** @type {(after: _PendingStack, property: BindingProperty) => _PendingStack} */
    ((after, property) => pushed(after, { property, parent })),
    pending)

/**
 * The entries a checked pattern makes of its source, numbered from `base`
 * — the position the first takes in the body being built — and the words
 * it binds, each to the entry holding its value, in the order written
 * ([spec: destructuring](../../../spec/README.md#destructuring)): one
 * entry per read of the plan, one binding per name, linear in both.
 *
 * A name's one entry is the source itself, which is what a `const` of a
 * name has always made. An array pattern's first entry is the spread of
 * the source, `[...source]` — JavaScript reads array destructuring through
 * `GetIterator` as it reads a spread, so a source that is not iterable
 * fails as a spread of it does and a string yields its code points — and
 * each element's source is the element the spread put there, `$0[i]`. An
 * object pattern's first entry is the source itself, evaluated once
 * however many properties read it, and each property's source is the
 * access `$0.key`, with every rule of an access: a `null` or `undefined`
 * source fails there, as `RequireObjectCoercible` fails. Every entry is
 * established whether or not a name reads it, as every `const` is, so
 * `const { a: { b } } = {};` fails as it fails in JavaScript, and an empty
 * pattern's one read keeps its failure.
 *
 * A member of the `Object` namespace is read as the static function
 * itself, `Object.is`, the entry the access makes; a pattern over the
 * namespace reads nothing else, so `value` is read by no entry and a
 * caller passes none, `undefined`, {@link namespaceOf}.
 *
 * @type {(plan: _Plan, value: AstConst, base: number) => _Lowered}
 */
const lowered = ({ reads, names }, value, base) => ({
    entries: reads.map(
        /** @type {(read: _Read) => AstConst} */
        (({ source, spread }) => {
            /** @type {AstConst} */
            const read = source === null ? value
                : source[0] === 'Object.is' ? source
                : ['.', ['cref', base + source[0]], source[1]]
            return spread ? ['array', [['...', read]]] : read
        })),
    bound: names.map(
        /** @type {(name: readonly [DjsTokenWithMetadata, number]) => readonly [string, AstModuleRef]} */
        (([token, i]) => [nameOf(token), ['cref', base + i]])),
})

/** Whether the step after a key makes the key a call's: any step but a property. @type {(step: Step | undefined) => boolean} */
const isCallStep = step => step !== undefined && step[0] !== '|.'

/** The parts of a chain's steps, {@link chainParts}: each key with whether a call follows it, and each argument's operand. @type {(step: Step | undefined) => readonly _ChainPart[]} */
const stepParts = step => {
    if (step === undefined) { return [] }
    if (step[0] === '|.') { return [{ key: step[1], method: isCallStep(step[2]) }, ...stepParts(step[2])] }
    return [...step[1].map(item => ({ value: operandOf(item) })), ...stepParts(step[2])]
}

/**
 * The operands of a chain in document order, {@link _ChainPart}: its base
 * or callee, then each key — with whether a call step follows it, which
 * is what makes the key a method call's — and each argument's operand,
 * in the order they are written, which is the order they are evaluated in
 * and the order their errors are reported in.
 *
 * @type {(chain: Chain) => readonly _ChainPart[]}
 */
const chainParts = chain => {
    if (chain[0] === '?.()') { return [{ value: chain[1] }, ...chain[2].map(item => ({ value: operandOf(item) })), ...stepParts(chain[3])] }
    return [{ value: chain[1] }, { key: chain[2], method: isCallStep(chain[3]) }, ...stepParts(chain[3])]
}

/**
 * A chain's steps with their values put back, from `at` in `values`: a
 * key's name where its token was, each argument's value under its spread.
 *
 * @type {(step: Step, values: readonly AstConst[], at: number) => AstStep}
 */
const stepClosed = (step, values, at) => {
    const [tag, x, next] = step
    if (tag === '|.') {
        const key = /** @type {AstKey} */ (values[at])
        return next === undefined ? ['|.', key] : ['|.', key, stepClosed(next, values, at + 1)]
    }
    const args = x.map((item, i) => itemValue(item)(values[at + i]))
    return /** @type {AstStep} */ (next === undefined ? [tag, args] : [tag, args, stepClosed(next, values, at + x.length)])
}

/**
 * A chain closed over its parts' values, {@link chainParts}'s order: the
 * AST's own shape, which is the EDAG's, with each value where its operand
 * was and each key's name where its token was.
 *
 * @type {(chain: Chain, values: readonly AstConst[]) => AstConst}
 */
const chainClosed = (chain, values) => {
    if (chain[0] === '?.()') {
        const [, , items, step] = chain
        const args = items.map((item, i) => itemValue(item)(values[1 + i]))
        return step === undefined ? ['?.()', values[0], args] : ['?.()', values[0], args, stepClosed(step, values, 1 + items.length)]
    }
    const [tag, , , step] = chain
    const key = /** @type {AstKey} */ (values[1])
    return /** @type {AstConst} */ (step === undefined ? [tag, values[0], key] : [tag, values[0], key, stepClosed(step, values, 2)])
}

/**
 * The next part of a chain, or the chain closed when none is left: a
 * value is entered under the frame, and a key is judged here, by the call
 * rule where a call follows it, and its name kept with the values — in
 * document order, so that the first error met is the first written.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _ChainFrame) => _State}
 */
const chainRound = (stack, scope, frame) => {
    const { parts, index } = frame
    if (index === parts.length) { return [stack, scope, ok(chainClosed(frame.chain, toArray(frame.done)))] }
    const part = parts[index]
    if ('value' in part) { return [{ top: frame, rest: stack }, scope, ['enter', part.value]] }
    const { key } = part
    if (key instanceof Array) { return keyEntered(stack, scope, key, frame) }
    const [tag, named] = checkedKey(key, part.method)
    if (tag === 'error') { return [stack, scope, error(named)] }
    return chainRound(stack, scope, { ...frame, index: index + 1, done: concat(frame.done)([named]) })
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

/**
 * The node an item evaluates: a value's own, or a spread's operand — the
 * spread itself is put back once the operand has its value,
 * {@link itemValue}.
 *
 * @type {(item: Item) => Node}
 */
const operandOf = item => item[0] === '...' ? item[1] : item

/**
 * An item's value from its operand's: the value, or the spread of it where
 * the item was a spread.
 *
 * @type {(item: Item) => (value: AstConst) => AstItem}
 */
const itemValue = item => value => {
    if (item[0] !== '...') { return value }
    /** @type {AstSpread} */
    const spread = ['...', value]
    return spread
}

/**
 * The node an entry evaluates: a member's value, or a spread's operand —
 * a spread is the one entry that is a tuple, a member being a record.
 *
 * @type {(entry: Entry) => Node}
 */
const entryOperandOf = entry => entry instanceof Array ? entry[1] : entry.value

/** @type {(container: Container, index: number) => Node} */
const itemAt = ([kind, items], index) =>
    kind === 'array' ? operandOf(items[index]) : entryOperandOf(items[index])

/**
 * The node a member's computed key is, or `null` where the item at `index`
 * has none: an array's item, a spread, or a member whose key is a constant.
 *
 * @type {(container: Container, index: number) => Node | null}
 */
const computedKeyAt = ([kind, items], index) => {
    if (kind === 'array') { return null }
    const entry = items[index]
    return entry instanceof Array || entry.spelling !== 'computed' ? null : entry.node
}

/**
 * A container's item at `index` as the AST holds it, from its value: an
 * array's item, its spread put back, {@link itemValue}; an object's spread
 * likewise, or its member, a property of its name and the value — the
 * computed key's value, `key`, where the member has one. A member is the
 * one item that is a record: an array's items and a spread are tuples.
 *
 * @type {(container: Container, index: number, key: readonly [AstConst] | null, value: AstConst) => AstItem | AstMember}
 */
const containerValue = ([, items], index, key, value) => {
    const entry = items[index]
    if (entry instanceof Array) { return itemValue(entry)(value) }
    /** @type {AstMember} */
    const member = [':', key === null ? /** @type {ConstantMember} */ (entry).name : key[0], value]
    return member
}

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
    const member = items[index]
    // a spread names no key, and a computed key is an own property's
    if (member instanceof Array || member.spelling === 'computed') { return null }
    const { key, name, spelling } = member
    return name === protoKey && spelling !== 'shorthand' ? protoKeyError(key) : null
}

/**
 * A container of the items its rounds built: an array, or an object of
 * its members in the order they are written, a repeated key written
 * twice. The order is not the parser's to change — it is the order the
 * graph a module denotes has, as JavaScript reads the same literal — and
 * the duplicates are not its to collapse: `run` builds the object
 * JavaScript builds, and EDAG's object constructor takes the members as
 * written, which the syntax alone still has. The items are the
 * container's kind's, {@link containerValue}, which the list's one type
 * does not say.
 *
 * @type {(container: Container, done: readonly (AstItem | AstMember)[]) => AstConst}
 */
const close = ([kind], done) => {
    if (kind === 'array') {
        /** @type {AstArray} */
        const array = ['array', /** @type {readonly AstItem[]} */ (done)]
        return array
    }
    /** @type {AstObject} */
    const object = ['object', /** @type {readonly AstEntry[]} */ (done)]
    return object
}

/**
 * The next round of a container: its item's key checked first, then the
 * key entered where it is computed and not yet evaluated, or the item's
 * value — or the container closed when no item is left.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _ContainerFrame) => _State}
 */
const round = (stack, scope, frame) => {
    const { container, index, done, key } = frame
    if (index >= container[1].length) { return [stack, scope, ok(close(container, toArray(done)))] }
    const rejected = badKey(container, index)
    if (rejected !== null) { return [stack, scope, error(rejected)] }
    const computed = computedKeyAt(container, index)
    return [{ top: frame, rest: stack }, scope, ['enter', computed !== null && key === null ? computed : itemAt(container, index)]]
}

/**
 * A container's frame with a value returned to it: the computed key's,
 * kept for the value's round, or the item's, which the next round follows.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _ContainerFrame, value: AstConst) => _State}
 */
const containerReturned = (stack, scope, frame, value) => {
    const { container, index, done, key } = frame
    return computedKeyAt(container, index) !== null && key === null
        ? round(stack, scope, { ...frame, key: [value] })
        : round(stack, scope, { ...frame, index: index + 1, done: concat(done)([containerValue(container, index, key, value)]), key: null })
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
const callOperandAt = (call, index) => index === 0 ? call[1] : operandOf(call[2][index - 1])

/**
 * A call's value at `index`, an argument's spread put back: the callee is
 * never one.
 *
 * @type {(call: _CallFrame['call'], index: number, value: AstConst) => AstItem}
 */
const callValue = (call, index, value) => index === 0 ? value : itemValue(call[2][index - 1])(value)

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
    const closed = ['()', /** @type {AstConst} */ (callee), args]
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
 * What `word` names in `scope` itself: a name it binds, or, where it
 * binds none and the word is the function's own, {@link entered}, the
 * function itself, `['self']`. The name comes after the bindings as it
 * does in JavaScript, where a parameter or a body `const` of the same
 * word shadows the `const` the function is the value of.
 *
 * @type {(scope: _Scope, word: string) => _Ref | null}
 */
const bound = (scope, word) => {
    const ref = at(word)(scope.names)
    if (ref !== null || scope.self !== word) { return ref }
    /** @type {AstSelf} */
    const self = ['self']
    return self
}

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
 * functions deep costs no call stack. A body that has captured a word
 * binds it, to its slot ({@link captured}), so the walk out stops at the
 * nearest body that has read the word before, and a read repeated through
 * many bodies — every guard of a long body reading the same parameter,
 * say — costs a step, not a walk.
 *
 * The function's own name is bound the same way once the body has read
 * it, so that a `const` of the name after the read is refused as a
 * capture shadowed is — in JavaScript the read would have named the
 * `const`, before its initializer ran — while a `const` of a name the
 * body has not read shadows the function's name, as it does there.
 *
 * @type {(scope: _Scope, word: string) => readonly [_Scope, _Ref] | null}
 */
const resolve = (scope, word) => {
    /** The bodies the word is read through, the one just inside the binding scope on top. @type {List<_Scope>} */
    let through = null
    let binder = scope
    let ref = bound(binder, word)
    while (ref === null) {
        if (binder.outer === null) { return null }
        through = { first: binder, tail: through }
        binder = binder.outer
        ref = bound(binder, word)
    }
    /** @type {readonly [_Scope, _Ref]} */
    let result = [ref[0] === 'self' ? { ...binder, names: extended(binder.names)(word, ref) } : binder, ref]
    for (const body of toArray(through)) {
        result = captured(body, word, result)
    }
    return result
}

/**
 * A body with the value the scope around it resolved `word` to captured,
 * that scope rebuilt as its `outer`: a new slot after the rest, since a
 * body captures a word once — the word is bound in its names from then on
 * and never resolved past it again.
 *
 * @type {(body: _Scope, word: string, outer: readonly [_Scope, _Ref]) => readonly [_Scope, _Ref]}
 */
const captured = (body, word, [outer, ref]) => {
    /** @type {AstFrameRef} */
    const slot = ['fref', body.captures.length]
    return [{
        ...body,
        outer,
        captures: [...body.captures, ref],
        // the word is the body's to answer from now on: a later read of it,
        // in this body or through it, stops here rather than walking out
        // again, and a `const` of it in this body is refused as a capture
        // shadowed
        names: extended(body.names)(word, slot),
    }, slot]
}

/**
 * The names a function's body begins with, the function's `length`, and
 * the entries the body begins with, {@link _Bound}: a rest parameter bound
 * to `['rest']`, each fixed parameter that is a name bound to its position
 * — the read of that argument, `['arg', i]`, the name erased — and each
 * fixed parameter that is a pattern checked and lowered as a `const`'s is,
 * {@link planned} and {@link lowered}, its source the argument, so that
 * its reads are the first entries of the body and each name it binds is
 * bound to the entry holding its value
 * ([spec: destructuring](../../../spec/README.md#destructuring)). Nothing
 * else is the body's own; a name bound outside is a capture,
 * {@link resolve}. The `length` is what JavaScript gives the function, the
 * fixed parameters counted, a pattern as one, the rest parameter not.
 *
 * An empty parameter list binds nothing, so a body under it starts from no
 * names of its own: the arguments are unreachable, having no name, and
 * every other word is a capture or `const not found` exactly as it is
 * under a parameter that does not spell it. That is the whole of what an
 * empty list costs: the function the fold returns has the `length` a rest
 * parameter gives it, `0`, so nothing downstream can tell the two lists
 * apart.
 *
 * A parameter's name is refused as a `const` is: a reserved word, or a
 * name the list already binds — in a parameter before it, or in the same
 * pattern — `(a, a) => 1` being a syntax error in JavaScript for an arrow
 * function. A list whose head is no target was refused before any word of
 * it, {@link malformedParameters}, and so is an `=>` on a line after the
 * list, {@link arrowed}. A fixed parameter past the language's limit is
 * refused, {@link tooManyParameters}, a pattern at its opening bracket.
 *
 * @type {(list: ParameterList) => Result<_Bound, ParseError>}
 */
const functionScope = list => {
    if ('invalid' in list) { return error(malformedParameters(list.invalid)) }
    if ('arrow' in list) { return error(unexpectedToken(list.arrow)) }
    /** @type {_Bound} */
    let bound = { names: empty, count: list.fixed.length, entries: [] }
    for (const [i, target] of list.fixed.entries()) {
        if (i === maxLength) { return error(tooManyParameters(target[1])) }
        /** @type {_Parameter} */
        const arg = ['arg', i]
        if (target[0] === 'name') {
            const [tag, word] = bindable(bound.names)(target[1])
            if (tag === 'error') { return error(word) }
            bound = { ...bound, names: extended(bound.names)(word, arg) }
            continue
        }
        const [tag, plan] = planned(bindable(bound.names))(target, null)
        if (tag === 'error') { return error(plan) }
        const { entries, bound: names } = lowered(plan, arg, bound.entries.length)
        bound = {
            ...bound,
            names: names.reduce((env, [word, ref]) => extended(env)(word, ref), bound.names),
            entries: [...bound.entries, ...entries],
        }
    }
    if (list.rest === null) { return ok(bound) }
    const [tag, word] = bindable(bound.names)(list.rest)
    return tag === 'error' ? error(word) : ok({ ...bound, names: extended(bound.names)(word, restBinding) })
}

/**
 * The next step of a function's block body: the `const` at `index`, its
 * names checked before its value is entered, {@link planned} — as a
 * module's `const` is, so that a statement wrong in both halves answers
 * for the half a reader meets first — the condition of a guard, or the
 * value of the explicit final `return` or `throw`.
 *
 * A guard is the body's last entry, whatever follows it in the source: its
 * condition is entered here, and {@link returned} then makes the arms of
 * the conditional it lowers to — the guard's block, and the statements
 * after the guard, each resolved as the body of a parameterless function of
 * its own under a {@link _GuardFrame}, {@link arm}. So `if (c) { const x =
 * f(); return [x, x]; } return 0;` is `c ? (() => { const x = f(); return
 * [x, x]; })() : (() => { return 0; })()`, the call the lowering inlines,
 * and a `const` after the guard is reached from the second arm alone, as
 * JavaScript never evaluates it when the first is taken.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _BodyFrame) => _State}
 */
const bodyRound = (stack, scope, frame) => {
    const { statements, first, index } = frame
    const [kind, statement] = statements[index]
    // the statement's own beginning before either half of it: the one
    // before it, written without its `;`, ends at a newline or not at all
    if (unterminated(index === first ? null : statements[index - 1][1], statement)) {
        return [stack, scope, error(unexpectedToken(statement.start))]
    }
    if (kind === 'if') { return [{ top: frame, rest: stack }, scope, ['enter', statement.condition]] }
    // a `while` reached here has no `let` before it: a `let` takes its
    // `while` with it, below
    if (kind === 'while') { return [stack, scope, error(whileWithoutLet(statement.start))] }
    if (kind === 'let') {
        // the statement after the `let` is its `while`; the block ends in a
        // terminator, so there is one
        if (statements[index + 1][0] !== 'while') { return [stack, scope, error(letWithoutWhile(statement.start))] }
        const [tag, word] = bodyBindable(scope)(statement.name)
        if (tag === 'error') { return [stack, scope, error(word)] }
        return [{ top: { let: statement, body: frame, word }, rest: stack }, scope, ['enter', statement.value]]
    }
    if (kind !== 'const') {
        return brokenLine(statement)
            ? [stack, scope, error(unexpectedToken(statement.first))]
            : [{ top: frame, rest: stack }, scope, ['enter', statement.value]]
    }
    const { target, value } = statement
    const namespace = namespaceOf(target, value)
    const [tag, plan] = planned(bodyBindable(scope))(target, namespace)
    if (tag === 'error') { return [stack, scope, error(plan)] }
    return [{ top: { ...frame, plan }, rest: stack }, scope, constValue(target, value, namespace)]
}

/**
 * What a body's `const` resolves before its names land: its value — a
 * function that is the whole value of a `const` of one name entered under
 * that name, its `self`, since a pattern names no function — or, for a
 * pattern over the `Object` namespace, nothing: the plan reads the
 * namespace's members alone, and the value it is lowered over is
 * `undefined`, read by no entry, {@link lowered}.
 *
 * @type {(target: BindingTarget, value: Node, namespace: DjsTokenWithMetadata | null) => _State[2]}
 */
const constValue = (target, value, namespace) => namespace !== null ? ok(undefined)
    : target[0] === 'name' ? ['define', value, nameOf(target[1])] : ['enter', value]

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
    if (isBinary(node)) { return [{ top: { tag: node[0], right: node[2] }, rest: stack }, scope, ['enter', node[1]]] }
    switch (node[0]) {
        case 'primitive': { return [stack, scope, ok(node[1])] }
        case 'ref': {
            const [tag, word] = identifierOf(node[1])
            if (tag === 'error') { return [stack, scope, error(word)] }
            const found = resolve(scope, word)
            if (found === null) { return [stack, scope, error(constNotFound(node[1]))] }
            // the first read of each loop variable from a nested function is
            // noted, and refused when the function closes held as a value
            const reads = found[0].loopReads
            const noted = capturedLoopVariable(scope, word) && !readsOf(reads, word)
            return [stack, noted ? { ...found[0], loopReads: [...reads, [word, loopVariableCaptured(node[1])]] } : found[0], ok(found[1])]
        }
        case '.': case '?.': {
            if (isRef(node[1], 'Object') && isKeyNamed(node[2], 'is')) { return objectIsRead(stack, scope, node) }
            return node[0] === '.' && node.length === 3
                ? [{ top: { key: node[2], method: isCallee(stack) }, rest: stack }, scope, ['enter', node[1]]]
                : chainRound(stack, scope, { chain: node, parts: chainParts(node), index: 0, done: null })
        }
        case '?.()': { return chainRound(stack, scope, { chain: node, parts: chainParts(node), index: 0, done: null }) }
        case '()': { return conversion(stack, scope, node) ?? callRound(stack, scope, { call: node, index: 0, done: null }) }
        case '-': { return [{ top: { neg: true }, rest: stack }, scope, ['enter', node[1]]] }
        case '~': { return [{ top: { bitnot: true }, rest: stack }, scope, ['enter', node[1]]] }
        case '!': { return [{ top: { not: true }, rest: stack }, scope, ['enter', node[1]]] }
        case 'typeof': { return [{ top: { typeof: true }, rest: stack }, scope, ['enter', node[1]]] }
        case 'String': { return [{ top: { conversion: 'String' }, rest: stack }, scope, ['enter', node[1]]] }
        // the left operand first, as every binary operator's: the right
        // side is checked when the left returns, so a fault in the left is
        // the one reported, the first in document order
        case 'instanceof': { return [{ top: { instanceof: node[2], at: node[3] }, rest: stack }, scope, ['enter', node[1]]] }
        case '?:': { return conditionalRound(stack, scope, { conditional: node, index: 0, done: null }) }
        case '=>': { return entered(stack, scope, node, null) }
        // a block stands only as a function's body, which `'=>'` above
        // enters; the mapping writes one nowhere else
        default: { return round(stack, scope, { container: /** @type {Container} */ (node), index: 0, done: null, key: null }) }
    }
}

/** Whether a node is the reference `word` spells. @type {(node: Item, word: string) => boolean} */
const isRef = (node, word) => node[0] === 'ref' && nameOf(node[1]) === word

/**
 * The conversion `Number(x)` or `String(x)` entered, or `null` where the call
 * is no conversion: a call whose callee is one of those words — which no scope
 * binds, since each word is refused at every binding, {@link identifierOf},
 * so the word alone decides — its one plain argument entered under a frame
 * holding the tag, {@link _ConversionFrame}. `Number()` is the literal `0`
 * and `String()` the empty-string literal, as JavaScript has them, folded
 * here as unary `-` over a literal is
 * folded, since a node of no operand would be a second spelling of the
 * leaf; the call of any other shape is refused at the word,
 * {@link conversionArity}. The word anywhere else is a reference, and
 * refused as every reserved word is.
 *
 * @type {(stack: _Stack, scope: _Scope, node: Extract<Node, readonly ['()', Node, readonly Item[]]>) => _State | null}
 */
const conversion = (stack, scope, [, callee, args]) => {
    if (callee[0] !== 'ref') { return null }
    const name = nameOf(callee[1])
    if (name !== 'Number' && name !== 'String') { return null }
    if (args.length === 0) { return [stack, scope, ok(name === 'Number' ? 0 : '')] }
    const operand = args.length === 1 ? args[0] : null
    if (operand === null || operand[0] === '...') { return [stack, scope, error(conversionArity(name)(callee[1]))] }
    return [{ top: { conversion: name }, rest: stack }, scope, ['enter', operand]]
}

/**
 * Whether an access's key is the constant `name`, in either spelling: a
 * computed key, `[Number(i)]`, names no constant.
 *
 * @type {(key: Key, name: string) => boolean}
 */
const isKeyNamed = (key, name) => !(key instanceof Array) && keyNamed(key) === name

/** `Object.is`, the one static function the language admits, as the AST holds it. @type {AstObjectIs} */
const objectIs = ['Object.is']

/**
 * The member of the `Object` namespace a key names, or `null` where the
 * language admits none: `is` alone
 * ([spec: built-in static functions](../../../spec/README.md#built-in-static-functions)),
 * each later name a decision of its own.
 *
 * @type {(named: string | number) => AstObjectIs | null}
 */
const objectMember = named => named === 'is' ? objectIs : null

/**
 * A read of `Object.is` entered: `Object.is` or `Object['is']`, guarded or
 * not, since a reserved global is never nullish — the AST's `['Object.is']`,
 * {@link objectIs}. The steps a chain goes on with are written over the
 * read as the nodes they are where nothing before them short-circuits,
 * and entered: `Object?.is(a, b)` is `Object.is(a, b)`, and a guarded call
 * among the steps keeps the steps after it as its own chain, which its
 * guard is still the head of. Over an explicit loop, so a chain as long as
 * the input allows costs no call stack.
 *
 * @type {(stack: _Stack, scope: _Scope, node: Extract<Node, readonly ['.' | '?.', Node, Key, ...unknown[]]>) => _State}
 */
const objectIsRead = (stack, scope, node) => {
    /** @type {Node} */
    let read = ['.', node[1], node[2]]
    /** @type {Step | undefined} */
    let step = node[3]
    if (step === undefined) { return [stack, scope, ok(objectIs)] }
    while (step !== undefined) {
        const [tag, x] = step
        const next = stepAfter(step)
        if (tag === '|?.()') { return [stack, scope, ['enter', next === undefined ? ['?.()', read, x] : ['?.()', read, x, next]]] }
        read = tag === '|.' ? ['.', read, x] : ['()', read, x]
        step = next
    }
    return [stack, scope, ['enter', read]]
}

/** The steps a chain goes on with after `step`, where it has any. @type {(step: Step) => Step | undefined} */
const stepAfter = ([, , next]) => next

/**
 * The word `Object` where a `const`'s pattern destructures the namespace
 * — an object pattern whose value is the bare word — and `null` otherwise.
 * Destructuring is sugar: the pattern reads each of its keys as the
 * access does, {@link planned}, so `const { is } = Object` is
 * `const is = Object.is`, and the namespace, which is no value, is never
 * entered. Any other pattern over the word, and the word alone, is
 * entered and refused as every reserved global is.
 *
 * @type {(target: BindingTarget, value: Node) => DjsTokenWithMetadata | null}
 */
const namespaceOf = (target, value) => target[0] === 'object' && value[0] === 'ref' && nameOf(value[1]) === 'Object' ? value[1] : null

/**
 * Whether a node is `Object.getOwnPropertyDescriptor(a, b)`, the helper's
 * descriptor, `a` and `b` the words its parameters bind: a plain call of
 * a plain access, the key in either spelling, as any key is read,
 * {@link isKeyNamed}.
 *
 * @type {(node: Node, a: string, b: string) => boolean}
 */
const isDescriptorOf = (node, a, b) => {
    if (node[0] !== '()' || node[2].length !== 2) { return false }
    const [, callee, [first, second]] = node
    return callee[0] === '.' && callee.length === 3 && isRef(callee[1], 'Object') && isKeyNamed(callee[2], 'getOwnPropertyDescriptor')
        && isRef(first, a) && isRef(second, b)
}

/**
 * Whether a node is `x?.enumerable ? x.value : undefined`, the helper's
 * entry, `x` the word its `const` binds: a guarded access and a plain one,
 * each ending its chain there.
 *
 * @type {(node: Node, x: string) => boolean}
 */
const isEntryOf = (node, x) => {
    if (node[0] !== '?:') { return false }
    const [, condition, then, otherwise] = node
    return condition[0] === '?.' && condition.length === 3 && isRef(condition[1], x) && isKeyNamed(condition[2], 'enumerable')
        && then[0] === '.' && then.length === 3 && isRef(then[1], x) && isKeyNamed(then[2], 'value')
        && otherwise[0] === 'primitive' && otherwise[1] === undefined
}

/**
 * The `entry` helper, recognized whole
 * ([spec: entry](../../../spec/README.md#reading-an-entry-at-run-time)):
 *
 * ```js
 * (a, b) => {
 *     const x = Object.getOwnPropertyDescriptor(a, b);
 *     return x?.enumerable ? x.value : undefined;
 * }
 * ```
 *
 * under any three distinct names — the AST's `['entry']`, the one function
 * whose body reads a property named at run time, and the one place the
 * `Object` namespace stands but `Object.is`. It is matched on the syntax
 * tree with its names resolved by the rules every other body follows: the
 * two parameters and the body's `const` are what the body reads back, and
 * `Object` is a reserved global, which no scope binds. `null` where the
 * function is not the helper, by shape or by binding, and the ordinary
 * resolution takes it from there, refusing the `Object` it cannot name; a
 * keyword, a reserved global such as `Array` or `Object`, or a repeated
 * name among the three is left to it the same way, to refuse as it
 * refuses every other. An error where the helper's two statements
 * break the line rules every block's statements keep, {@link unterminated}
 * and {@link brokenLine}, which the shape alone cannot see.
 *
 * @type {(node: Extract<Node, readonly ['=>', ParameterList, Node]>) => Result<AstEntryFunction, ParseError> | null}
 */
const entryFunction = ([, list, body]) => {
    if (!('fixed' in list) || list.fixed.length !== 2 || list.rest !== null || body[0] !== 'block' || body[1].length !== 2) { return null }
    const [p, q] = list.fixed
    const first = body[1][0]
    const last = body[1][1]
    if (first[0] !== 'const' || last[0] !== 'return') { return null }
    const [, declaration] = first
    const [, returned] = last
    // the two parameters and the descriptor are each bound to one name: a
    // pattern is a step away from the helper, so the function is an
    // ordinary one
    if (p[0] !== 'name' || q[0] !== 'name' || declaration.target[0] !== 'name') { return null }
    const a = nameOf(p[1])
    const b = nameOf(q[1])
    const x = nameOf(declaration.target[1])
    const names = [a, b, x]
    if (new Set(names).size !== names.length || names.some(word => isKeyword(word) || isReservedGlobal(word))) { return null }
    if (!isDescriptorOf(declaration.value, a, b) || !isEntryOf(returned.value, x)) { return null }
    if (unterminated(declaration, returned)) { return error(unexpectedToken(returned.start)) }
    if (brokenLine(returned)) { return error(unexpectedToken(returned.first)) }
    /** @type {AstEntryFunction} */
    const entry = ['entry']
    return ok(entry)
}

/**
 * A function entered: the `entry` helper where it is one,
 * {@link entryFunction}, and otherwise its body in a scope of
 * its own inside `scope`, under
 * its parameters and, where the function is the whole initializer of a
 * `const`, with that `const`'s name as its `self` — so a read of the name
 * in the body that no parameter or body `const` answers first is the
 * EDAG's own self-reference, {@link resolve}, and a function nested inside
 * captures it as it captures any value of the scope around it. Only the
 * function itself has the name: a `const` holding a function in an array,
 * or the result of calling one, is not in its own initializer's scope,
 * `const not found`, since neither is a function with a `self` to read.
 *
 * The entries a parameter pattern makes, {@link functionScope}, are the
 * first of the body: a block body's statements count from after them, and
 * an expression body's value follows them as the last entry.
 *
 * @type {(stack: _Stack, scope: _Scope, node: Extract<Node, readonly ['=>', ParameterList, Node]>, self: string | null) => _State}
 */
const entered = (stack, scope, node, self) => {
    // the helper first, whole: a function that is one has no body to
    // resolve
    const entry = entryFunction(node)
    if (entry !== null) { return [stack, scope, entry] }
    const [tag, bound] = functionScope(node[1])
    if (tag === 'error') { return [stack, scope, error(bound)] }
    const { names, count, entries } = bound
    /** @type {_Scope} */
    const inner = { names, count, captures: [], enclosing: null, outer: scope, self, loop: null, loopReads: [] }
    const body = node[2]
    return body[0] === 'block'
        ? bodyRound(stack, inner, { statements: body[1], first: 0, index: 0, plan: null, entries: entries.length, done: entries })
        : [{ top: { function: entries }, rest: stack }, inner, ['enter', body]]
}

/**
 * A value handed to the frame on top: the next round of a container with
 * the value among its items, an access closed over its base, or a function
 * closed over its body, {@link closed}.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _Frame, value: AstConst) => _State}
 */
const returned = (stack, scope, frame, value) => {
    if ('container' in frame) { return containerReturned(stack, scope, frame, value) }
    if ('call' in frame) { return callRound(stack, scope, { ...frame, index: frame.index + 1, done: concat(frame.done)([callValue(frame.call, frame.index, value)]) }) }
    if ('conditional' in frame) { return conditionalRound(stack, scope, { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }) }
    if ('key' in frame) {
        const { key, method } = frame
        return key instanceof Array ? keyEntered(stack, scope, key, { indexed: value }) : [stack, scope, accessClosed(key, method, value)]
    }
    if ('indexed' in frame) {
        /** @type {AstAccess} */
        const access = ['.', frame.indexed, /** @type {AstKey} */ (value)]
        return [stack, scope, ok(access)]
    }
    if ('chain' in frame) { return chainRound(stack, scope, { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }) }
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
    if ('not' in frame) {
        /** @type {AstNot} */
        const negated = ['!', value]
        return [stack, scope, ok(negated)]
    }
    if ('typeof' in frame) {
        /** @type {AstTypeof} */
        const tagged = ['typeof', value]
        return [stack, scope, ok(tagged)]
    }
    if ('instanceof' in frame) {
        // the right operand is a name, not a value: the one reference the
        // language has a meaning for, never resolved in scope — `Array` is
        // a reserved global, so no scope binds it
        const right = frame.instanceof
        if (right[0] !== 'ref' || nameOf(right[1]) !== 'Array') { return [stack, scope, error(instanceofRight(frame.at))] }
        /** @type {AstInstanceOf} */
        const checked = ['instanceof', value, 'Array']
        return [stack, scope, ok(checked)]
    }
    if ('conversion' in frame) {
        /** @type {AstNumber | AstString} */
        const converted = [frame.conversion, value]
        return [stack, scope, ok(converted)]
    }
    if ('right' in frame) { return [{ top: { tag: frame.tag, left: value }, rest: stack }, scope, ['enter', frame.right]] }
    if ('left' in frame) {
        /** @type {AstBinary} */
        const binary = [frame.tag, frame.left, value]
        return [stack, scope, ok(binary)]
    }
    if ('let' in frame) { return loopEntered(stack, scope, frame, value) }
    if ('loop' in frame) {
        if (frame.condition === null) {
            // the condition resolved in the loop's own scope: its block is
            // the body of a parameterless function inside it, a block of
            // JavaScript's own, marked with the variable as the loop's scope
            // is, {@link loopRound}
            return loopRound(
                { top: { ...frame, condition: value }, rest: stack },
                { names: empty, count: 0, captures: [], enclosing: null, outer: scope, self: null, loop: frame.word, loopReads: [] },
                { block: frame.loop.block[1], index: 0, word: frame.word, plan: null, entries: 0, done: null })
        }
        // the block closed, as the function it is the body of: the loop's
        // function is the conditional of the condition, the block's call,
        // and the variable itself — `r => c ? (() => { …; return self(next);
        // })() : r` — closed over its one entry, in the scope around it
        /** @type {AstCall} */
        const call = ['()', value, []]
        /** @type {AstConditional} */
        const conditional = ['?:', frame.condition, call, ['arg', 0]]
        return closed({ top: { called: frame.loop, body: frame.body, word: frame.word, init: frame.init }, rest: stack }, scope, [conditional])
    }
    if ('called' in frame) {
        // the loop's function closed: the two statements make one entry, its
        // call with the initial value, which the variable names from here
        // on, a `const` from the loop's end — and the `while` made no entry
        // of its own
        const { body, word } = frame
        /** @type {AstCall} */
        const call = ['()', value, [frame.init]]
        return bodyRound(
            stack,
            { ...scope, names: extended(scope.names)(word, ['cref', body.entries]) },
            { ...body, index: body.index + 2, entries: body.entries + 1, done: concat(body.done)([call]) })
    }
    if ('block' in frame) {
        const [kind, statement] = frame.block[frame.index]
        if (kind === 'const') {
            const plan = assertNotNullish(frame.plan, ['a const statement with no plan', statement])
            // a name its own initializer read from outside, as a body's
            const shadowed = plan.names.find(([name]) => at(nameOf(name))(scope.names) !== null)
            if (shadowed !== undefined) { return [stack, scope, error(captureShadowed(shadowed[0]))] }
            const { entries, bound } = lowered(plan, value, frame.entries)
            return loopRound(
                stack,
                { ...scope, names: bound.reduce((names, [word, ref]) => extended(names)(word, ref), scope.names) },
                { ...frame, index: frame.index + 1, entries: frame.entries + entries.length, done: concat(frame.done)(entries) })
        }
        // an assignment rebinds the loop's variable, which the block may
        // have read already: a new entry the word names from here on
        return loopRound(
            stack,
            { ...scope, names: extended(scope.names)(frame.word, ['cref', frame.entries]) },
            { ...frame, index: frame.index + 1, entries: frame.entries + 1, done: concat(frame.done)([value]) })
    }
    if ('statements' in frame) {
        const [kind, statement] = frame.statements[frame.index]
        if (kind === 'const') {
            const plan = assertNotNullish(frame.plan, ['a const statement with no plan', statement])
            // a name its own initializer read from outside: unbound when the
            // statement began, bound now only by the capture that read took
            const shadowed = plan.names.find(([name]) => at(nameOf(name))(scope.names) !== null)
            if (shadowed !== undefined) { return [stack, scope, error(captureShadowed(shadowed[0]))] }
            // the bindings land after the value, keeping the names out of
            // their own initializer's scope, and name the entries this
            // statement makes, after the ones the body has made so far
            const { entries, bound } = lowered(plan, value, frame.entries)
            return bodyRound(
                stack,
                { ...scope, names: bound.reduce((names, [word, ref]) => extended(names)(word, ref), scope.names) },
                { ...frame, index: frame.index + 1, entries: frame.entries + entries.length, done: concat(frame.done)(entries) })
        }
        // a guard's condition: its block is the first arm, a block of
        // JavaScript's own, so it may bind what the body has bound or read
        if (kind === 'if') { return arm(stack, scope, { guard: statement, body: frame, condition: value, then: null }, statement.block[1], 0, null) }
        // the body's last entry: what it returns, or the `throw` it ends with
        return closed(stack, scope, [...toArray(frame.done), kind === 'throw' ? thrown(value) : value])
    }
    if ('guard' in frame) {
        /** @type {AstCall} */
        const call = ['()', value, []]
        // the guard's block closed: the statements after the guard are the
        // second arm, JavaScript's same block as the ones before it — what
        // that block has bound, and what it has read from outside, the
        // condition and the first arm included, is not theirs to bind
        if (frame.then === null) { return arm(stack, scope, { ...frame, then: call }, frame.body.statements, frame.body.index + 1, { first: scope.names, tail: scope.enclosing }) }
        /** @type {AstConditional} */
        const conditional = ['?:', frame.condition, frame.then, call]
        return closed(stack, scope, [...toArray(frame.body.done), conditional])
    }
    // an expression body: its value is the last entry, after the ones the
    // function's parameter patterns made
    return closed(stack, scope, [...frame.function, value])
}

/**
 * An arm of a guard entered: its statements from `first` on — the guard's
 * block from its start, the statements after the guard from the position
 * after it in the body's own list, shared rather than copied — resolved as
 * the body of a parameterless function of its own, in a scope inside
 * `scope` that captures what it reads from there, under the guard's frame,
 * which receives the function once the body closes. `enclosing` is what
 * the arm may not bind: nothing for the guard's block, a block of
 * JavaScript's own; and for the statements after the guard the names of
 * the block they continue — what it has bound, and what it has read from
 * outside so far, in a statement before the guard, in the condition, or in
 * the guard's block, whose reads pass through the block's scope and are
 * remembered in its names — since a `const` of such a name after the guard
 * would have been the one every such read named in JavaScript, before its
 * declaration ({@link captureShadowed}).
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _GuardFrame, statements: Block[1], first: number, enclosing: List<_Env>) => _State}
 */
const arm = (stack, scope, frame, statements, first, enclosing) =>
    bodyRound({ top: frame, rest: stack }, { names: empty, count: 0, captures: [], enclosing, outer: scope, self: null, loop: null, loopReads: [] }, { statements, first, index: first, plan: null, entries: 0, done: null })

/**
 * A loop's initial value resolved: the `while` after the `let`, with the
 * line rule every statement keeps, and then its condition, in the scope
 * of the function the loop lowers to — its one parameter the variable,
 * bound to the first argument, the function itself under {@link loopSelf},
 * and the variable marked, {@link capturedLoopVariable}
 * ([spec: loops](../../../spec/README.md#loops)). A `let` whose initializer
 * read the word from outside is refused as a `const`'s is.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: Extract<_Frame, { readonly let: unknown }>, init: AstConst) => _State}
 */
const loopEntered = (stack, scope, frame, init) => {
    const { body, word } = frame
    if (at(word)(scope.names) !== null) { return [stack, scope, error(captureShadowed(frame.let.name))] }
    const next = body.statements[body.index + 1]
    // the `let` is followed by its `while`: {@link bodyRound} refused it otherwise
    const loop = /** @type {While} */ (next[1])
    if (unterminated(frame.let, loop)) { return [stack, scope, error(unexpectedToken(loop.start))] }
    /** @type {_Scope} */
    const inner = { names: extended(empty)(word, ['arg', 0]), count: 1, captures: [], enclosing: null, outer: scope, self: loopSelf, loop: word, loopReads: [] }
    return [{ top: { loop, body, word, init, condition: null }, rest: stack }, inner, ['enter', loop.condition]]
}

/**
 * The next step of a loop's block, the body of a parameterless function
 * inside the loop's: the `const` at `index`, its name checked before its
 * value is entered, as a body's is; or the assignment, which may name the
 * loop's variable alone and rebinds it for the statements after — in the
 * graph a new entry the word names, as a `const` is, so that the
 * statements read the value in order, as JavaScript reads them. The
 * block's end continues the loop: the body closes over the call of the
 * loop's function, {@link loopSelf}, with the variable's binding then —
 * the last assignment's entry, or the argument as it came in — each a
 * capture of the block's function as any read from outside is.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _LoopBodyFrame) => _State}
 */
const loopRound = (stack, scope, frame) => {
    const { block, index, word } = frame
    if (index === block.length) {
        // both bound in the loop's scope around this one, so neither read is `null`
        const callee = assertNotNullish(resolve(scope, loopSelf), ['a loop block outside its loop', word])
        const next = assertNotNullish(resolve(callee[0], word), ['a loop block outside its loop', word])
        /** @type {AstCall} */
        const call = ['()', callee[1], [next[1]]]
        return closed(stack, next[0], [...toArray(frame.done), call])
    }
    const [kind, statement] = block[index]
    if (unterminated(index === 0 ? null : block[index - 1][1], statement)) {
        return [stack, scope, error(unexpectedToken(statement.start))]
    }
    if (kind === 'const') {
        const { target, value } = statement
        const namespace = namespaceOf(target, value)
        const [tag, plan] = planned(bodyBindable(scope))(target, namespace)
        if (tag === 'error') { return [stack, scope, error(plan)] }
        const shadowing = plan.names.find(([name]) => nameOf(name) === word)
        if (shadowing !== undefined) { return [stack, scope, error(loopVariableShadowed(shadowing[0]))] }
        return [{ top: { ...frame, plan }, rest: stack }, scope, constValue(target, value, namespace)]
    }
    const [tag, bound] = identifierOf(statement.name)
    if (tag === 'error') { return [stack, scope, error(bound)] }
    if (bound !== word) { return [stack, scope, error(notTheLoopVariable(statement.name))] }
    return [{ top: { ...frame, plan: null }, rest: stack }, scope, ['enter', statement.value]]
}

/**
 * Whether a read of `word` in `scope` is a loop's variable read from a
 * function nested in the loop — in its condition or its block — and not
 * from the loop's own scope or its block's: out from `scope` to the
 * nearest scope that binds the word or is marked with it, the read is
 * noted, {@link closed} refusing it, where that scope is marked and is not
 * `scope` itself. A nearer
 * binding of the word, a nested function's own parameter say, shadows the
 * variable as it does in JavaScript.
 *
 * @type {(scope: _Scope, word: string) => boolean}
 */
const capturedLoopVariable = (scope, word) => {
    let s = scope
    while (s.loop !== word) {
        if (s.outer === null || at(word)(s.names) !== null) { return false }
        s = s.outer
    }
    return s !== scope
}

/**
 * A function closed over its body, resolved in `scope`: the scope around
 * it in force again — with every capture the body took on the way — its
 * `length`, and the body's own captures, where there are any, the
 * function's fourth element.
 *
 * @type {(stack: _Stack, scope: _Scope, body: readonly AstConst[]) => _State}
 */
const closed = (stack, scope, body) => {
    const outer = assertNotNullish(scope.outer, ['a function body with no scope around it', body])
    /** @type {AstFunction} */
    const fn = scope.captures.length === 0 ? ['=>', scope.count, body] : ['=>', scope.count, body, scope.captures]
    if (scope.loopReads.length === 0) { return [stack, outer, ok(fn)] }
    // a function that read a loop's variable is refused, at its first such
    // read, unless it is called where it is written — the callee of a
    // call, or a loop's own function or block, which the loop calls —
    // since called at once its closure sees the round's value as
    // JavaScript's does, where held as a value it may outlive the round,
    // when JavaScript's would see the variable's last value; and each
    // read is the enclosing function's too, whose frame holds the
    // variable for this one's, out to the scope the variable is the
    // loop's in
    if (!(scope.loop !== null || (stack !== null && 'call' in stack.top && stack.top.index === 0))) { return [stack, outer, error(scope.loopReads[0][1])] }
    const passed = scope.loopReads.filter(([word]) => word !== outer.loop && !readsOf(outer.loopReads, word))
    return [stack, { ...outer, loopReads: [...outer.loopReads, ...passed] }, ok(fn)]
}

/**
 * Whether `reads`, a scope's reads of loop variables, holds a read of
 * `word`.
 *
 * @type {(reads: _Scope['loopReads'], word: string) => boolean}
 */
const readsOf = (reads, word) => reads.some(([read]) => read === word)

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
 * `self` is the word a `const` binds the value to, or `null` for a value
 * that is no `const`'s: a function that is the whole value is entered with
 * the word bound to itself, {@link entered}, as a body `const`'s is.
 *
 * @type {(env: _Env, self: string | null) => (root: Node) => Result<AstConst, ParseError>}
 */
const evaluate = (env, self) => root => {
    /** @type {_State} */
    let state = [null, { names: env, count: 0, captures: [], enclosing: null, outer: null, self: null, loop: null, loopReads: [] }, self === null ? ['enter', root] : ['define', root, self]]
    while (true) {
        const [stack, scope, step] = state
        const [tag, payload] = step
        if (tag === 'enter') {
            state = enter(stack, scope, payload)
        } else if (tag === 'define') {
            // a `const`'s value: a function is entered under its own name
            state = payload[0] === '=>' ? entered(stack, scope, payload, step[2]) : enter(stack, scope, payload)
        } else if (tag === 'error') {
            return error(payload)
        } else if (stack === null) {
            // the root's value, every body closed
            return ok(payload)
        } else {
            state = returned(stack.rest, scope, stack.top, payload)
        }
    }
}

/**
 * The word a binding may take: an identifier, refusing a keyword, and one
 * the environment does not hold — `import` and `const` share the one map,
 * so a name taken by either is taken for both, `duplicate id`.
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
    return at(word)(env) === null ? ok(word) : error(duplicateId(name))
}

/**
 * The word a body `const` may take: {@link bindable}'s question asked of
 * the body's own names and of the names of the block it continues, the
 * statements after a guard being JavaScript's one block with the ones
 * before it. A name any of them binds is `duplicate id`; one none binds
 * but one has read from outside — bound to a slot of its frame, or to the
 * function itself, {@link bound} — is `capture shadowed`, and the binding
 * wins where both hold, as it does in JavaScript, where the read named the
 * block's own binding. A name the
 * body's own initializer reads is refused once it has been, in
 * {@link returned}.
 *
 * @type {(scope: _Scope) => (name: DjsTokenWithMetadata) => Result<string, ParseError>}
 */
const bodyBindable = scope => name => {
    const [tag, word] = identifierOf(name)
    if (tag === 'error') { return error(word) }
    const refs = [scope.names, ...toArray(scope.enclosing)].flatMap(env => {
        const ref = at(word)(env)
        return ref === null ? [] : [ref]
    })
    if (refs.some(ref => ref[0] !== 'fref' && ref[0] !== 'self')) { return error(duplicateId(name)) }
    return refs.length === 0 ? ok(word) : error(captureShadowed(name))
}

/** The environment with a word bound to a reference, its two questions already answered. @type {(env: _Env) => (word: string, ref: _Ref) => _Env} */
const extended = env => (word, ref) => setReplace(word)(ref)(env)

/** An export as the module's result object holds it: a member of its name and node. @type {(e: readonly [string, AstConst]) => AstMember} */
const exportMember = ([name, value]) => [':', name, value]

/**
 * The statements of a module, in order: each imported binding names
 * the next argument, each `const` resolves its value against the names
 * bound so far — itself not among them, so a `cref` always names an earlier
 * entry — and then binds its name. The default export is resolved against
 * them all and placed in the module's result object; a `throw` in its
 * place is resolved the same way and is the body's last entry instead of
 * that object, the module being a function whose body ends in it — its
 * named exports, if any, unreachable and so not recorded. Ordinary
 * function bodies keep their own return values.
 *
 * @type {(module: Module) => Result<AstModule, ParseError>}
 */
const foldModule = ({ imports, consts, exported, thrown: failing }) => {
    /** @type {_Env} */
    let env = empty
    /** @type {readonly AstImport[]} */
    let modules = []
    /** @type {readonly AstConst[]} */
    let body = []
    /** @type {readonly (readonly [string, AstConst])[]} */
    let exports = []
    // the statement before the one being read, whose omitted `;` the one
    // being read has to begin a line for
    /** @type {Statement | null} */
    let previous = null
    for (const statement of imports) {
        if (unterminated(previous, statement)) { return error(unexpectedToken(statement.start)) }
        previous = statement
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
    for (const { declaration, exported: named } of consts) {
        const { target, value: node } = declaration
        // the statement's beginning first, then the names, then the value: a
        // statement wrong in more than one answers for what a reader meets
        // first
        if (unterminated(previous, declaration)) { return error(unexpectedToken(declaration.start)) }
        previous = declaration
        const namespace = namespaceOf(target, node)
        const [tag, plan] = planned(bindable(env))(target, namespace)
        if (tag === 'error') { return error(plan) }
        const then = named ? plan.names.find(([name]) => nameOf(name) === 'then') : undefined
        if (then !== undefined) { return error({ message: 'reserved export name then', metadata: then[0].metadata }) }
        // a function that is the whole value of a `const` of one name is
        // entered under that name, its `self`; a pattern names no function,
        // and a pattern over the `Object` namespace enters nothing,
        // {@link constValue}
        const [resolved, value] = namespace !== null ? ok(undefined) : evaluate(env, target[0] === 'name' ? nameOf(target[1]) : null)(node)
        if (resolved === 'error') { return error(value) }
        const { entries, bound } = lowered(plan, value, body.length)
        env = bound.reduce((names, [word, ref]) => extended(names)(word, ref), env)
        if (named) { exports = [...exports, ...bound] }
        body = [...body, ...entries]
    }
    if (failing !== null) {
        if (unterminated(previous, failing)) { return error(unexpectedToken(failing.start)) }
        if (brokenLine(failing)) { return error(unexpectedToken(failing.first)) }
        const [resolved, last] = evaluate(env, null)(failing.value)
        if (resolved === 'error') { return error(last) }
        /** @type {AstModule} */
        const failingModule = [modules, [...body, thrown(last)]]
        return ok(failingModule)
    }
    if (exported !== null) {
        if (unterminated(previous, exported)) { return error(unexpectedToken(exported.start)) }
        const [resolved, last] = evaluate(env, null)(exported.value)
        if (resolved === 'error') { return error(last) }
        exports = [...exports, ['default', last]]
    }
    // an exported pattern binding no name exports nothing, and the grammar
    // saw only the `export`: the module is refused where a name was owed
    if (exports.length === 0) {
        const last = assertNotNullish(consts.findLast(c => c.exported), ['a module with no export and no throw', consts])
        return error(noExport(last.declaration.start))
    }
    // annotated rather than inferred: a bare `[modules, body]` widens to an
    // array, because `readonly string[]` is itself assignable to `AstBody`.
    /** @type {AstModule} */
    const astModule = [modules, [...body, ['object', toArray(sort(exports)).map(exportMember)]]]
    return ok(astModule)
}

/**
 * Reads the token list as a FunctionalScript module: `import` statements, then
 * `const` and `export const` statements, with an optional final `export default`
 * — or a final `throw` in its place. At least one export is required of a
 * module that does not throw; every statement ends with `;`, or where
 * JavaScript inserts one — before a statement on a new line, before `}`,
 * and at the end of the input.
 *
 * This is the only language the parser reads. A JSON document is data, not a
 * module, and `fjs/media/json` is its reader
 * ([spec: JSON input](../../../spec/README.md#json-input)).
 *
 * The grammar it accepts is written down in `./grammar`, read by
 * `./syntax`, and what the grammar accepts and this refuses is the fold's:
 * a name unbound or bound twice, and a plain `__proto__` key.
 *
 * @type {(tokenList: List<DjsTokenWithMetadata>) => Result<AstModule, ParseError>}
 */
export const parseFromTokens = tokenList => {
    const [tag, module] = parseSyntax(tokenList)
    return tag === 'error' ? error(module) : foldModule(module)
}

/**
 * Where a {@link ParseError} happened, as much of it as is known: the token's
 * `path:line:column` when the reader tracks positions; otherwise the file
 * the error names, when it names one — a missing import, a cycle, a body
 * that fails to evaluate, in an imported module as readily as in the input;
 * and otherwise `inputFileName`, the file being compiled — which no reader
 * `fjs compile` runs produces any more, every reader naming its file, and
 * which this parser's one contract failure, a token list with no end,
 * still can.
 *
 * An error that knows how far the offending source runs renders as a span,
 * `path:line:column-column` within one line and `path:line:column-line:column`
 * across several. Only lexical errors carry one today; a grammar failure points
 * at a single token and prints the point form.
 *
 * @type {(inputFileName: string) => (parseError: ParseError) => string}
 */
export const errorLocation = inputFileName => ({ metadata, end, path }) => {
    if (metadata === null) { return path ?? inputFileName }
    const start = `${metadata.path}:${metadata.line}:${metadata.column}`
    if (end === undefined) { return start }
    // the path is printed once — a token does not straddle files — and the
    // line is dropped from the far end when the span stays on one line, so the
    // common case reads `a.js:1:1-7` rather than repeating `1:`
    const far = end.line === metadata.line
        ? `${end.column}`
        : `${end.line}:${end.column}`
    return `${start}-${far}`
}
