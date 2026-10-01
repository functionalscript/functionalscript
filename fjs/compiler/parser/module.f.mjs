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
 * JavaScript. Export names select those bindings into the module result,
 * with an optional final default expression.
 *
 * The grammar sees symbols and the fold sees text, which is the line that
 * decides where a check belongs: every check that has to read a *word* is
 * the fold's — a reference to a name nothing binds, a name bound twice by
 * `import` or `const`, which share one map, a JavaScript keyword bound or
 * referenced, since the tokenizer hands every keyword over as an
 * identifier and a key or the name after `.` may be one, and a bare or
 * string `__proto__` key, which JavaScript reads as an instruction to replace the
 * prototype; the computed spelling `{ ["__proto__"]: v }` denotes an
 * ordinary property and is accepted. So is every check that has to read
 * a token's *line*: trivia is not in the stream, and whether a newline
 * stood before a token is a fact the token carries, so a statement
 * written without its `;` ends where JavaScript inserts one, and whether
 * the next statement began a line is the fold's to ask of its first token,
 * {@link unterminated}, the grammar having read the `;` as optional and
 * looked no further; and the places JavaScript forbids a line break,
 * before `=>` and after `return` or `throw`, are the fold's the same way. The error
 * reported is the first met in document order, and a match that fails
 * builds no module: a malformed suffix is found before any name is
 * resolved. `./README.md` holds the argument.
 *
 * A guard, `if (c) block`, is the fold's to shape as well as to check: it
 * is syntactic sugar, and the fold writes what it is sugar for. The
 * guard's block and the statements after it are each the body of a
 * parameterless function called where it stands — the call the lowering
 * inlines, {@link bodyRound} — and the guard is the conditional of the
 * two, `c ? (() => { …block… })() : (() => { …rest… })()`, so a `const` of
 * either arm is the arm's alone and the graph is the one that spelling
 * has ([spec: functions](../../../spec/README.md#functions)). No node is
 * added to the AST for it.
 *
 * The resolution walks a value over an explicit stack of frames, so
 * nesting depth stays the input's.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { AstAccess, AstArray, AstBinary, AstBitnot, AstCall, AstConditional, AstConst, AstFrameRef, AstFunction, AstNeg, AstImport, AstMember, AstModule, AstModuleRef, AstObject, AstRest, AstThrow } from '../ast/types.ts'
 * @import { ParseError } from './types.ts'
 * @import { Block, Container, Entry, If, Import, Module, Node, ParameterBinding, ParameterList, Statement, ValueStatement } from './syntax/types.ts'
 * @import { _AccessFrame, _BodyFrame, _CallFrame, _ConditionalFrame, _ContainerFrame, _Env, _Frame, _GuardFrame, _Parameter, _Ref, _Scope, _Stack, _State } from './private.ts'
 */

import { error, mapOk, ok } from '../../types/result/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { at, empty, setReplace } from '../../types/ordered_map/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { maxLength } from '../../types/function/length/module.f.mjs'
import { isKeyword } from '../../js/keywords/module.f.mjs'
import { prohibitedCalls, prototypeNames } from '../../js/prototype/module.f.js'
import { nameOf, parseSyntax, textOf } from './syntax/module.f.mjs'

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
 * A parameter list whose first parameter is no plain name, at the `(` that
 * opened it — `(1) => 2`, `(a.b) => 1`, `((a)) => 1` — JavaScript's own
 * early error, by its own name. The grammar admits the value there so
 * that one symbol can decide between a list and a group (`afterValue` in
 * `./grammar/module.f.mjs`), and this is the check that decision left.
 */
const malformedParameters = foldError('malformed parameter list')

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
 * @type {(previous: Statement | If | null, next: Statement | If) => boolean}
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
 * error in JavaScript, so it is an error here.
 *
 * @type {(name: DjsTokenWithMetadata) => Result<string, ParseError>}
 */
const identifierOf = name => {
    const word = nameOf(name)
    return isKeyword(word) ? error(reservedWord(name)) : ok(word)
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
        if (method && _prohibitedCallNames.has(named)) { return error(prohibitedCall(key)) }
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
 * The names a function's body begins with, and the function's `length`:
 * a rest parameter bound to `['rest']`, and each fixed parameter
 * bound to its position — the read of that argument, `['arg', i]`,
 * the name erased — and nothing else of its own; a name bound outside is a
 * capture, {@link resolve}. The `length` is what JavaScript gives the
 * function, the named parameters counted, the rest parameter not.
 *
 * An empty parameter list binds nothing, so a body under it starts from no
 * names of its own: the arguments are unreachable, having no name, and
 * every other word is a capture or `const not found` exactly as it is
 * under a parameter that does not spell it. That is the whole of what an
 * empty list costs: the function the fold returns has the `length` a rest
 * parameter gives it, `0`, so nothing downstream can tell the two lists
 * apart.
 *
 * A named parameter is refused as a `const` is: a reserved word, or a
 * name the list already binds, `(a, a) => 1` being a syntax error in
 * JavaScript for an arrow function. A list whose head is no name was
 * refused before any word of it, {@link malformedParameters}, and so is
 * an `=>` on a line after the list, {@link arrowed}. A fixed parameter
 * past the language's limit is refused, {@link tooManyParameters}.
 *
 * @type {(list: ParameterList) => Result<readonly [_Env, number], ParseError>}
 */
const functionScope = list => {
    if ('invalid' in list) { return error(malformedParameters(list.invalid)) }
    if ('arrow' in list) { return error(unexpectedToken(list.arrow)) }
    /** @type {(acc: Result<_Env, ParseError>, binding: ParameterBinding, i: number) => Result<_Env, ParseError>} */
    const bind = (acc, { name, rest }, i) => {
        if (acc[0] === 'error') { return acc }
        if (!rest && i === maxLength) { return error(tooManyParameters(name)) }
        const [tag, word] = bindable(acc[1])(name)
        return tag === 'error' ? error(word) : ok(extended(acc[1])(word, rest ? restBinding : ['arg', i]))
    }
    return mapOk(
        /** @type {(env: _Env) => readonly [_Env, number]} */
        (env => [env, list.filter(p => !p.rest).length]),
    )(list.reduce(bind, ok(empty)))
}

/**
 * The next step of a function's block body: the `const` at `index`, its name
 * checked before its value is entered — as a module's `const` is, so that a
 * statement wrong in both halves answers for the half a reader meets first
 * — the condition of a guard, or the value of the explicit final `return`
 * or `throw`.
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
    if (kind !== 'const') {
        return brokenLine(statement)
            ? [stack, scope, error(unexpectedToken(statement.first))]
            : [{ top: frame, rest: stack }, scope, ['enter', statement.value]]
    }
    const [tag, word] = bodyBindable(scope)(statement.name)
    if (tag === 'error') { return [stack, scope, error(word)] }
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
            const [tag, bound] = functionScope(node[1])
            if (tag === 'error') { return [stack, scope, error(bound)] }
            const [names, count] = bound
            /** @type {_Scope} */
            const inner = { names, count, captures: [], enclosing: null, outer: scope }
            const body = node[2]
            return body[0] === 'block'
                ? bodyRound(stack, inner, { statements: body[1], first: 0, index: 0, word: '', done: null })
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
            // a name its own initializer read from outside: unbound when the
            // statement began, bound now only by the capture that read took
            if (at(frame.word)(scope.names) !== null) { return [stack, scope, error(captureShadowed(statement.name))] }
            // the binding lands after the value, keeping the name out of its
            // own initializer's scope, and names the entry this statement
            // makes, counted from the body's first
            return bodyRound(
                stack,
                { ...scope, names: extended(scope.names)(frame.word, ['cref', frame.index - frame.first]) },
                { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) })
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
    return closed(stack, scope, [value])
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
    bodyRound({ top: frame, rest: stack }, { names: empty, count: 0, captures: [], enclosing, outer: scope }, { statements, first, index: first, word: '', done: null })

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
    let state = [null, { names: env, count: 0, captures: [], enclosing: null, outer: null }, ['enter', root]]
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

/**
 * The word a body `const` may take: {@link bindable}'s question asked of
 * the body's own names and of the names of the block it continues, the
 * statements after a guard being JavaScript's one block with the ones
 * before it. A name any of them binds is `duplicate id`; one none binds
 * but one has read from outside — bound to a slot of its frame — is
 * `capture shadowed`, and the binding wins where both hold, as it does in
 * JavaScript, where the read named the block's own binding. A name the
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
    if (refs.some(ref => ref[0] !== 'fref')) { return error(duplicateId(name)) }
    return refs.length === 0 ? ok(word) : error(captureShadowed(name))
}

/** The environment with a word bound to a reference, its two questions already answered. @type {(env: _Env) => (word: string, ref: _Ref) => _Env} */
const extended = env => (word, ref) => setReplace(word)(ref)(env)

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
    /** @type {readonly AstMember[]} */
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
        const { name, value: node } = declaration
        // the statement's beginning first, then the name, then the value: a
        // statement wrong in more than one answers for what a reader meets
        // first
        if (unterminated(previous, declaration)) { return error(unexpectedToken(declaration.start)) }
        previous = declaration
        const [tag, word] = bindable(env)(name)
        if (tag === 'error') { return error(word) }
        if (named && word === 'then') { return error({ message: 'reserved export name then', metadata: name.metadata }) }
        const [resolved, value] = evaluate(env)(node)
        if (resolved === 'error') { return error(value) }
        env = extended(env)(word, ['cref', body.length])
        if (named) { exports = [...exports, [word, ['cref', body.length]]] }
        body = [...body, value]
    }
    if (failing !== null) {
        if (unterminated(previous, failing)) { return error(unexpectedToken(failing.start)) }
        if (brokenLine(failing)) { return error(unexpectedToken(failing.first)) }
        const [resolved, last] = evaluate(env)(failing.value)
        if (resolved === 'error') { return error(last) }
        /** @type {AstModule} */
        const failingModule = [modules, [...body, thrown(last)]]
        return ok(failingModule)
    }
    if (exported !== null) {
        if (unterminated(previous, exported)) { return error(unexpectedToken(exported.start)) }
        const [resolved, last] = evaluate(env)(exported.value)
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
