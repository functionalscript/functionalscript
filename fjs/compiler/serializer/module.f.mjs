/**
 * The FunctionalScript writer: a linked EDAG in, a module the parser
 * accepts out, so that compiling the output again yields the same graph.
 *
 * ```text
 * Exp ==the analysis==> the table ==this writer==> FunctionalScript text
 * ```
 *
 * It is the output the language's own extension asks for, and the one that
 * can hold what the language accepts: DataJS has no functions, so a module
 * holding one has no `.data.js` and no `.json`, and until this writer it had
 * no output but the EDAG document, which describes the function as data
 * rather than being one.
 *
 * **It writes the graph, not the value.** Nothing is executed, so a module
 * holding a function is written, and so is one whose value a reader would
 * refuse — a read of `null` is the program's failure to make when it runs.
 *
 * **What a `const` is for.** A node that mints identity — `[]`, `{}`, `=>` —
 * is one value however many edges reach it, and only a `const` keeps that in
 * text, so a shared one is hoisted, and so is a shared node holding one
 * through a lazy edge, whose text written twice would mint twice
 * ({@link hoistedKind}). A node the analysis merged — an access, an
 * operator over values — is written in place at every occurrence instead,
 * since the occurrences merge again when the output is read: hoisting one
 * would evaluate it where the source did not. Every `const` has a symbolic identity
 * among its scope's statements; the document allocates its final name in
 * declaration order, so that one graph is one text.
 *
 * **A scope writes its own `const`s.** A module and a function body are the
 * same thing here — statements, then a value, introduced by `export default`
 * or by `return` — so a body hoists what it needs into a block of its own
 * ([spec: functions](../../../spec/README.md#functions)):
 *
 * ```js
 * export default ()=>{const $0=[1];return [$0,$0];};
 * ```
 *
 * **A lazy operand is a block root.** The right operand of `&&`, `||` and
 * `??` and an arm of `?:` is established only when the operator decides
 * to, so a value shared under it alone cannot take a `const` of the scope
 * — that would establish it whatever the operator decides — and takes one
 * in a block opened at the operand instead: an IIFE, which is the call the
 * front end inlines, so that reading it back gives the operand again
 * ({@link block}). A comma under a lazy operand, the anchors of an inlined
 * body, is written as the same block. What a scope hoists is what its own
 * root reaches eagerly, {@link hoists}; a value a lazy operand alone
 * reaches is the operand's block's, and one two lazy operands reach with
 * no eager path has no text and is refused.
 *
 * ```js
 * export default (...$0)=>$0[0]?(()=>{const $1=[1];return [$1,$1];})():4;
 * ```
 *
 * Every generated binding takes the next available `$n` in declaration
 * order across the entire output: constants, parameters, and nested scopes
 * share one counter. Exported names are reserved first. References reuse
 * their binding's name, so no generated binding shadows another. Rendering
 * uses symbolic scope/slot identities; the output boundary allocates numbers.
 *
 * **A function with slots is a closure.** Each slot takes a
 * `const` in the scope around the function, even one written in place
 * otherwise, since a capture is a name; a read of the frame's slot `i` is
 * that name, and a parameter of the scope, or a slot that reads the
 * scope's own frame, has its name already: `(...$0)=>()=>$0`. Read back, the body's outside names are its captures in
 * first-use order, which the writer keeps to the frame's by naming the
 * slots in order first where its own text would read them in another
 * ({@link closureBody}):
 *
 * ```js
 * const $0=[1];export default (...$1)=>[$0,$1[0]];
 * ```
 *
 * A body needing no `const` keeps the expression form, `=> v`, which is the
 * same function and the shorter text.
 *
 * **An operator's text binds as JavaScript's does.** Every operator the
 * language has is spelled, with the parentheses its precedence asks for
 * and no more ({@link levels}, {@link operandGrouped}): `1+2*3` and
 * `(1+2)*3`, `2**3**2` and `(2**3)**2`, `(-2)**2`, which JavaScript
 * refuses bare, and `1- -2`, whose two minus characters would otherwise be
 * the one decrement token. A function stands in a group under any of
 * them, `-(()=>1)`, and so does an operator's text under an access,
 * `(1+2).x`, since every operator binds looser than a step.
 *
 * **A call is written as JavaScript's.** `f(a,b)`, and `a.b(c)` for a
 * method call; a callee that is an access, a function or a number takes a
 * `const` ({@link calleeHoisted}), and one that is an operator's text
 * stands in a group, `($a+1)()`.
 *
 * **A `throw` is a statement where a scope ends, and a call elsewhere.** A
 * scope whose value is a `throw` node ends in the statement it came from,
 * `throw v;` in place of `return v;` or `export default v;`, so a function
 * whose body throws is always a block. A `throw` node anywhere else — an
 * arm of `?:` once `if` lowers there, or wherever a hand-built graph puts
 * one — is written as the call of a function that throws,
 * `(()=>{throw v;})()`: JavaScript's one spelling of an expression that
 * fails, and FunctionalScript itself — the call the front end inlines, so
 * the text reads back as the node it was written from
 * ([spec: functions](../../../spec/README.md#functions)).
 *
 * **One line, normalized**, as the DataJS output is, and its leaves are the
 * DataJS serializer's, which owns their spelling.
 *
 * **What it refuses**, each by name and with nothing written: a node kind it
 * has no spelling for, which is how a feature that adds one is made to add
 * its spelling here in the same change; a comma anywhere but where a block
 * begins — a module's root, a function's body and a lazy operand are read
 * as one, and anywhere else a comma has no source form until the operator
 * lands; a key the parser would not read back — one no literal spells, and
 * one naming a property of a built-in prototype, which the grammar refuses
 * in either spelling; a call whose arguments are no array literal of its
 * own; slots the parser would not build
 * ({@link frameNames}, {@link closureBody}); an anchor that reads back as no anchor ({@link statement}); and a
 * shared value under a lazy operand that anything outside the operand
 * reaches ({@link block}).
 *
 * Raw-expression entry points refuse invalid function length metadata and
 * graphs that break the EDAG's scope rule through the same diagnostic channel
 * as unsupported output. `functionText` reuses an admitted analysis instead.
 *
 * @module
 *
 * @import { Analysis, ItemOperand, Node, Operand, Ref, Step } from '../../edag/analysis/types.ts'
 * @import { Exp } from '../../edag/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Document } from './types.ts'
 * @import { _Hoisted, _Names, _Root, _Scope, _Statement, _Written } from './private.ts'
 */

import { _defaultExport, _moduleExports, _moduleThrows } from '../edag/module.f.mjs'
import { keywords, literalWords } from '../../js/keywords/module.f.mjs'
import { analysis, checked, itemOperand, mergeable, operandsOf, stepOperands } from '../../edag/analysis/module.f.mjs'
import { keySerialize, leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { arrayWrap, colon, objectWrap, wrap } from '../../media/json/serializer/module.f.mjs'
import { first, flat, toArray } from '../../types/list/module.f.mjs'
import { _prohibitedCallNames, _prohibitedNames } from '../parser/module.f.mjs'
import { dollarSign, isDigit, isLatinLetter, lowLine } from '../../text/ascii/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { error, mapOk, ok, okList, okThen } from '../../types/result/module.f.mjs'
import { renderFunction } from './function_text/module.f.mjs'
import { _name as name, _binding as binding, _resolve as resolve } from './names/module.f.mjs'

/** Names the parser refuses to bind. */
const reservedExports = new Set([...keywords, ...literalWords, 'then'])

/**
 * The node kinds that keep a `const`: one value however many edges reach
 * one, which only a `const` keeps in text — a node that mints identity,
 * `[]`, `{}`, `=>`, and a call, which written twice calls twice. The
 * analysis merges none of them.
 *
 * @type {(node: Node) => boolean}
 */
const minting = node => !mergeable(node)

/**
 * Whether a shared entry takes a `const`: one that mints identity, and one
 * that holds, through a lazy edge, a node that does or a comma — `a ? []
 * : 1` referenced twice, whose text written twice would build the array
 * twice, where a shared node the entry reaches eagerly is the scope's own
 * `const` already and reads back as one node from wherever the entry's
 * text stands. Every other shared entry — an access, an operator over
 * values — is written in place at each occurrence, since the occurrences
 * merge again when the output is read.
 *
 * It reads no names: its walks go on past a value a scope has named, so a
 * shared access over one takes a `const` it need not —
 * `const $1=$0[0]?[]:1;const $2=$1.k;` — which costs text and not the
 * round trip. {@link block}, asking what its own text would build, stops
 * at names instead.
 *
 * @type {(a: Analysis, i: number) => boolean}
 */
const hoistedKind = (a, i) => minting(a.nodes[i])
    || eagerFrom(a)(['#', i]).flatMap(j => lazyOperands(a.nodes[j])).flatMap(reachableFrom(a)).some(j => minting(a.nodes[j]) || a.nodes[j][0] === ',')

/**
 * Whether a base needs a `const` of its own — three bases this writer has
 * no text for, though linking puts all of them there:
 *
 * - a number or a bigint, since `1.x` is one number and a stray word, and
 *   the space `1 .x` needs is not a spelling this writer keeps;
 * - a function, which takes no access in the grammar.
 *
 * An operator's text is no base either, since every operator binds looser
 * than a step — `-1[0]` is `-(1[0])` — but it has a text of its own: the
 * group the grammar reads, `(-[1])[0]` ({@link base}); a negated number is
 * a number by the time it reaches here, folded by the lowering.
 *
 * @type {(a: Analysis, base: Operand) => boolean}
 */
const basedHoisted = (a, base) => !(base instanceof Array)
    ? typeof base === 'number' || typeof base === 'bigint'
    : a.nodes[base[1]][0] === '=>'

/** Two hoisted values are one when they name the same entry, or the same primitive by `Object.is`. @type {(x: _Hoisted, y: _Hoisted) => boolean} */
const sameHoisted = (x, y) => x[0] === y[0] && Object.is(x[1], y[1])

/**
 * The slot a hoisted value took in its scope, or `null` where it has none
 * yet. A slot an anchor's `const` took holds no value and matches nothing.
 *
 * @type {(names: _Names, h: _Hoisted) => number | null}
 */
const slotOf = (names, h) => {
    const i = names.findIndex(([n]) => n !== null && sameHoisted(n, h))
    return i === -1 ? null : i
}

/**
 * The name a read of a parameter is written as, in a scope whose function's
 * parameters have scope identity `param`: a symbolic rest or fixed argument
 * reference, and none for any other node.
 *
 * @type {(param: string, node: Node) => string | null}
 */
const parameterName = (param, node) => {
    switch (node[0]) {
        case 'rest': { return name(`${param}/rest`) }
        case 'arg': { return name(`${param}/arg${node[1]}`) }
        default: { return null }
    }
}

/** A constant's symbolic identity within its rendering scope. @type {(path: string, i: number) => string} */
const hoistName = (path, i) => name(`${path}/const${i}`)

/** The names a scope sees: the scopes' around it, then its own. @type {(s: _Scope) => _Names} */
const visible = s => [...s.outer, ...s.names]

/** The name a hoisted value took in the scope at `path`, or `null` where it has none yet. @type {(names: _Names, h: _Hoisted) => string | null} */
const nameOf = (names, h) => {
    const i = slotOf(names, h)
    return i === null ? null : names[i][1]
}

/** What may open an identifier: a Latin letter, `_` or `$`. @type {(codePoint: number) => boolean} */
const identifierStart = codePoint =>
    isLatinLetter(codePoint) || codePoint === lowLine || codePoint === dollarSign

/**
 * Whether a word is one the tokenizer reads as a single `id` token, and so
 * may follow a `.` rather than be written as a key in brackets.
 *
 * The characters are classified by code point through
 * [`text/ascii`](../../text/ascii/module.f.mjs), which is where the rest of
 * the repository's lexical rules ask what a character is
 * ([`../../js/identifier/todo`](../../js/identifier/todo/lexical-predicates-from-text-ascii.md)).
 * A case fold would not do: `'\u212a'`, the Kelvin sign, lowercases to `k`
 * and is no letter the tokenizer takes.
 *
 * @type {(key: string) => boolean}
 */
const identifierKey = key => {
    const word = toArray(stringToCodePointList(key))
    return word.length !== 0
        && identifierStart(word[0])
        && word.every(c => identifierStart(c) || isDigit(c))
}

/** Whether the function that is entry `i` reads its own `['self']`, in its own body's scope. @type {(a: Analysis, i: number) => boolean} */
const readsSelf = (a, i) => a.nodes.some((n, j) => n[0] === 'self' && a.scope[j] === i)

/** Whether an entry reads a slot of the frame, `['frame', i]`. @type {(a: Analysis, v: Ref) => boolean} */
const isSlotRead = (a, v) => a.nodes[v[1]][0] === 'frame'

/** Whether an operand is written as a name the scope binds without a `const`: the arguments, a parameter, or a slot of the frame. @type {(a: Analysis, v: Operand) => boolean} */
const isName = (a, v) => v instanceof Array && (['rest', 'arg', 'self'].includes(a.nodes[v[1]][0]) || isSlotRead(a, v))

/**
 * The value a `throw` entry throws, where the operand is one, and `null`
 * where it is not: what a scope ending in a `throw` writes after the
 * keyword. The value is boxed, since `null` is itself a value a program
 * may throw, and `throw null;` is a `throw` all the same.
 *
 * @type {(a: Analysis, v: Operand) => readonly [Operand] | null}
 */
const thrownValue = (a, v) => {
    if (!(v instanceof Array)) { return null }
    const node = a.nodes[v[1]]
    return node[0] === 'throw' ? [node[1]] : null
}

/**
 * The text of an operand at rendering `path`: a primitive
 * as the DataJS serializer spells it, a hoisted value by its name, and any
 * other entry in place.
 *
 * @type {(s: _Scope, path: string) => (v: Operand) => Document}
 */
const operand = (s, path) => v => {
    if (!(v instanceof Array)) { return ok(leafSerialize(v)) }
    const name = nameOf(visible(s), ['entry', v[1]])
    return name === null ? entry(s, `${path}/entry${v[1]}`)(v[1]) : ok([name])
}

/**
 * The node an operand's text spells, for the parentheses around it: `null`
 * for a primitive or a name, which take none anywhere, and the node
 * otherwise.
 *
 * @type {(s: _Scope, v: Operand) => Node | null}
 */
const nodeOf = (s, v) => !(v instanceof Array) || nameOf(visible(s), ['entry', v[1]]) !== null ? null : s.a.nodes[v[1]]

/** The kind of node an operand's text spells, {@link nodeOf}'s tag. @type {(s: _Scope, v: Operand) => string | null} */
const kindOf = (s, v) => {
    const node = nodeOf(s, v)
    return node === null ? null : node[0]
}

/**
 * The operators by level, loosest first, JavaScript's own ladder
 * ([spec: operators](../../../spec/README.md#operators)): the conditional;
 * `||` and `??` — one level, though the two never mix bare — `&&`; and
 * under them the eager binary operators, Stage A, `|` down to `**`. The
 * two prefixes, `-` of one operand and `~`, bind tighter than every level
 * here, and everything else this writer spells — a name, a primitive, an
 * access, a container, the call a nested `throw` is, the `Number`
 * conversion — tighter still.
 *
 * @type {readonly (readonly string[])[]}
 */
const levels = [
    ['?:'], ['||', '??'], ['&&'],
    ['|'], ['^'], ['&'], ['===', '!=='], ['<', '<=', '>', '>='], ['<<', '>>', '>>>'], ['+', '-'], ['*', '/', '%'], ['**'],
]

/** The level of an operator, `0` the loosest; `-1` for a tag that is none. @type {(op: string) => number} */
const level = op => levels.findIndex(l => l.includes(op))

/** Whether a node is a prefix operator's: `-` of one operand, `~`, `!` or `typeof`. @type {(node: Node) => boolean} */
const isPrefix = node => node[0] === '~' || node[0] === '!' || node[0] === 'typeof' || (node[0] === '-' && node.length === 2)

/**
 * How tightly a node's text binds: its operator's {@link level}, a prefix
 * one above the last level, and anything that is no operator — a name, a
 * primitive, which {@link nodeOf} gives as `null` — one above that.
 *
 * @type {(node: Node | null) => number}
 */
const precedence = node => {
    if (node === null) { return levels.length + 1 }
    if (isPrefix(node)) { return levels.length }
    const i = level(node[0])
    return i === -1 ? levels.length + 1 : i
}

/** Whether a node's text is an operator's, and binds looser than a prefix does. @type {(node: Node | null) => boolean} */
const isOperator = node => precedence(node) < levels.length

/** `??` beside `&&` or `||` is a syntax error bare, whichever holds the other. @type {(kind: string, op: string) => boolean} */
const mixesNullish = (kind, op) => (kind === '??') !== (op === '??') && ['&&', '||', '??'].includes(kind)

/**
 * An operand in parentheses where its text would otherwise read as part
 * of what surrounds it, and as it stands otherwise: a function is no
 * operand of an operator bare — `()=>1 && 2` is one function — and an
 * operator's text binds as {@link precedence} says.
 *
 * @type {(grouped: boolean) => (text: List<string>) => List<string>}
 */
const grouped = grouped => text => grouped ? flat([['('], text, [')']]) : text

/**
 * Whether an operand of the binary operator `op` — its left operand, or
 * its right one — needs parentheses: a function; a `??` beside `&&`/`||`
 * or the reverse; a node binding looser than the operator; and one binding
 * as loosely on the side the operator does not associate to, where a bare
 * same operator would read as the other operand's — the right of every
 * operator but `**`, `1-(2-3)`, and the left of `**`, which associates to
 * the right, `(2**3)**2`.
 *
 * @type {(op: string, right: boolean) => (node: Node | null) => boolean}
 */
const operandGrouped = (op, right) => node => node !== null && (
    node[0] === '=>'
    || mixesNullish(node[0], op)
    || precedence(node) < level(op)
    || (precedence(node) === level(op) && right !== (op === '**')))

/**
 * The text of an eager operand of the binary operator `op`, its left one.
 * A text opening with a prefix, `-` or `~` — a prefix operator's, or a
 * negative number's — is grouped before `**`, `(-2)**2`: JavaScript reads
 * `-2 ** 2` as neither of its two parenthesizations and refuses it, and so
 * does the grammar ([spec: operators](../../../spec/README.md#operators)).
 *
 * @type {(s: _Scope, path: string, op: string) => (v: Operand) => Document}
 */
const leftOperand = (s, path, op) => v => mapOk(
    /** @type {(text: List<string>) => List<string>} */
    (text => grouped(operandGrouped(op, false)(nodeOf(s, v)) || (op === '**' && opensWithPrefix(text)))(text)),
)(operand(s, path)(v))

/** Whether a text opens with a prefix: `-`, `~`, `!` or `typeof`. @type {(text: List<string>) => boolean} */
const opensWithPrefix = text => ['-', '~', '!', 'typeof'].some(p => firstChunk(text).startsWith(p))

/** The text of the right operand of the eager binary operator `op`. @type {(s: _Scope, path: string, op: string) => (v: Operand) => Document} */
const rightOperand = (s, path, op) => v => mapOk(grouped(operandGrouped(op, true)(nodeOf(s, v))))(operand(s, path)(v))

/**
 * The text of an eager binary operator, `left+right` and its Stage A
 * siblings, each operand in parentheses where {@link operandGrouped} says.
 * A `-` before a text opening with `-` takes a space, `1- -2`: two
 * adjacent minus characters are the one decrement token, which the parser
 * has no rule for. No other pair of operator and operand meets that way,
 * since no text opens with any other operator's character.
 *
 * @type {(s: _Scope, path: string) => (op: string, left: Operand, right: Operand) => Document}
 */
const binary = (s, path) => (op, left, right) => mapOk(
    /** @type {(parts: readonly List<string>[]) => List<string>} */
    (([l, r]) => flat([l, [op === '-' && opensWithMinus(r) ? '- ' : op], r])),
)(okList([leftOperand(s, `${path}/left`, op)(left), rightOperand(s, `${path}/right`, op)(right)]))

/** Whether a text opens with `-`. @type {(text: List<string>) => boolean} */
const opensWithMinus = text => firstChunk(text).startsWith('-')

/**
 * The text of a prefix operator, `-v`, `~v`, `!v` or `typeof v`: the operand
 * in parentheses
 * where it is an operator's text, which binds looser than a prefix,
 * `-(1+2)`, and bare otherwise, another prefix included, `-~1`. `- -1` and
 * not `--1`, for the reason {@link binary} has. A function stands in a
 * group, `-(()=>1)`: JavaScript's prefix operand is a
 * `UnaryExpression`, which an arrow function is not, and the group is one.
 * `typeof` is a word, so a space follows it whatever the operand opens
 * with, `typeof 1` and `typeof (1+2)`: `typeof(1+2)` is JavaScript too, but
 * one spelling is simpler than a rule for when the space may go.
 *
 * @type {(s: _Scope, path: string) => (op: string) => (v: Operand) => Document}
 */
const prefix = (s, path) => op => v => mapOk(
    /** @type {(text: List<string>) => List<string>} */
    (text => flat([[op === 'typeof' ? 'typeof ' : op === '-' && opensWithMinus(text) ? '- ' : op], text])),
)(mapOk(grouped(isOperator(nodeOf(s, v)) || kindOf(s, v) === '=>'))(operand(s, path)(v)))

/** An operand's text in place, with whether it is a block; a name and a primitive are neither. @type {(s: _Scope, path: string) => (v: Operand) => Result<_Written, string>} */
const inPlace = (s, path) => v => mapOk((/** @type {List<string>} */ text) => ({ text, block: false }))(operand(s, path)(v))

/**
 * The text of a lazy operand — the right operand of `&&`, `||` or `??`, an
 * arm of `?:` — which is a block root: written as a block where it needs
 * one ({@link block}), and in place otherwise, in parentheses where
 * `takes` says its kind needs them. A block is a call, and takes none.
 *
 * @type {(s: _Scope, path: string, takes: (node: Node | null) => boolean) => (v: Operand) => Document}
 */
const lazyOperand = (s, path, takes) => v => mapOk(
    /** @type {(w: _Written) => List<string>} */
    (({ text, block }) => grouped(!block && takes(nodeOf(s, v)))(text)),
)(block(s, path)(v))

/**
 * A lazy operand as its own block, where it needs one: an IIFE,
 * `(()=>{const …;return …;})()`, whose statements are the operand's comma
 * anchors, if it is a comma, and the `const`s of what the operand's own
 * block hoists — the shared values it reaches eagerly that no scope
 * around it named, {@link hoists} — and whose `return` is the operand's
 * value. Read back, the call is inlined and the block is the operand
 * again: its `const`s the shared nodes and the anchors, its captures the
 * names around it. An operand needing neither is written in place.
 *
 * The block opens its own rendering scope, its names its own and the names
 * around it visible, and its parameter the enclosing function's, since it
 * has none: a read of the arguments inside it is the function's.
 *
 * A node under the operand that anything outside the operand reaches too
 * is written outside as well, so where it is, or holds, a value a `const`
 * keeps and no scope around the block named, the block is refused: a
 * `const` in the block establishes the value exactly when the operand is
 * established, which is right only where nothing else reads it — `a ? [c,
 * c] : c` has no text that reads back as one node, nor has `[a && [c], b
 * && [c]]`, and `a ? c.length : c.length`, one access over one array,
 * would build the array twice. Linking emits no such graph: what a body's
 * `const` shares, the body holds, and the body is one operand once
 * inlined; and a scope's `const` two lazy positions reach is anchored, an
 * eager reach the scope hoists for. What a value named around the block
 * holds is not the block's: the value's `const` writes it once, and every
 * occurrence reads the name — in `x.a === 1 || x.a === 2`, `x` a `const`
 * holding a call or a nested array, the lazy operand builds nothing.
 *
 * @type {(s: _Scope, path: string) => (v: Operand) => Result<_Written, string>}
 */
const block = (s, path) => v => {
    /** @type {_Scope} */
    const inner = { a: s.a, allowUnusedCaptures: s.allowUnusedCaptures, outer: visible(s), names: [], frame: s.frame, param: s.param, eager: eagerFrom(s.a)(v), shared: sharedWithin(s.a)(v), self: s.self, binding: null }
    /** @type {(i: number) => boolean} */
    const unnamed = i => nameOf(inner.outer, ['entry', i]) === null
    // Reached from outside by an edge the operand's subgraph does not
    // hold: a count by edges, so that sharing the scope counts through a
    // node holding the operand — a `const` there, {@link hoistedKind} —
    // does not count here. The entry and what it holds are walked through
    // unnamed entries alone, each asked only whether it mints or is a
    // comma: a named entry is written in its own `const` and read by name,
    // so nothing under it is the block's to build, and {@link hoistedKind},
    // whose walks go on past names, would count what lies behind one. The
    // candidate walk and the count still go through names, which changes
    // no answer: what a named entry holds eagerly is its scope's, which
    // names each value there that a `const` keeps and two places read, and
    // what it holds lazily, or shares past the block that names it, went
    // through this test before the name was given.
    const outside = reachableFrom(s.a)(v).find(w => unnamed(w)
        && references(s.a, w) > referencesWithin(s.a, v, w)
        && reachableThrough(s.a, unnamed)(['#', w]).some(i => minting(s.a.nodes[i]) || s.a.nodes[i][0] === ','))
    if (outside !== undefined) { return error('a shared node reached from outside the lazy operand that establishes it') }
    return okThen(
        /** @type {(all: _Root) => Result<_Written, string>} */
        (all => all.length === 1 && hoists(inner)(all[0]).length === 0
            ? inPlace(s, path)(all[0])
            : mapOk(
                /** @type {(st: _Statement) => _Written} */
                (st => ({ text: flat([['(()=>{'], st.text, ['})()']]), block: true })),
            )(scope(inner, `${path}/block`, nothing)(all))),
    )(scopeOperands(s.a, v))
}

/**
 * The text of a lazy operator, `left && right` and its two siblings: the
 * left operand eager, the right a block root ({@link lazyOperand}).
 *
 * @type {(s: _Scope, path: string) => (node: readonly [string, Operand, Operand]) => Document}
 */
const lazyBinary = (s, path) => ([op, left, right]) => mapOk(
    /** @type {(parts: readonly List<string>[]) => List<string>} */
    (([l, r]) => flat([l, [op], r])),
)(okList([leftOperand(s, `${path}/left`, op)(left), lazyOperand(s, `${path}/right`, operandGrouped(op, true))(right)]))

/**
 * The text of a conditional, `c?t:e`: the condition eager, in parentheses
 * where it is a conditional or a function, and each arm a block root that
 * stands bare whatever it is — an arm is a whole value, a conditional or
 * a function included, as in JavaScript, and the text ends where `:`
 * cannot continue it.
 *
 * @type {(s: _Scope, path: string) => (node: readonly ['?:', Operand, Operand, Operand]) => Document}
 */
const conditional = (s, path) => ([, c, t, e]) => mapOk(
    /** @type {(parts: readonly List<string>[]) => List<string>} */
    (([cond, then, otherwise]) => flat([cond, ['?'], then, [':'], otherwise])),
)(okList([
    mapOk(grouped(kindOf(s, c) === '?:' || kindOf(s, c) === '=>'))(operand(s, `${path}/condition`)(c)),
    lazyOperand(s, `${path}/then`, () => false)(t),
    lazyOperand(s, `${path}/else`, () => false)(e),
]))

/**
 * An access's base: a hoisted one by its name, anything else as an operand.
 * The `const` it names is its own scope's, a body's as readily as the
 * module's, so a numeric or function base inside a body is written there
 * rather than refused.
 *
 * @type {(s: _Scope, path: string) => (v: Operand) => Document}
 */
const base = (s, path) => v => {
    if (!basedHoisted(s.a, v)) {
        // every operator, a prefix included, binds looser than a step, so
        // its text is grouped: `(-[1])[0]`, where `-[1][0]` is `-([1][0])`
        return mapOk(grouped(precedence(nodeOf(s, v)) <= levels.length))(operand(s, path)(v))
    }
    const h = /** @type {_Hoisted} */ (v instanceof Array ? ['entry', v[1]] : ['leaf', v])
    // Every such base was collected before the statement that needs it, so a
    // missing name is this writer's own mistake.
    return ok([assertNotNullish(nameOf(visible(s), h), ['an access base that was not hoisted', v])])
}

/**
 * An item of an array or of a call's arguments: its operand, and a spread
 * the same operand after `...`. Either is an `AssignmentExpression` in
 * JavaScript, so what an operand needs grouped is grouped alike.
 *
 * @type {(s: _Scope, path: string) => (v: ItemOperand) => Document}
 */
const item = (s, path) => v => v instanceof Array && v[0] === '...'
    ? mapOk(value => flat([['...'], value]))(operand(s, path)(v[1]))
    : operand(s, path)(/** @type {Operand} */(v))

/**
 * An object's entry: a property, `k: v`, or a spread, `...` before its
 * operand. A key that is not a string has no literal.
 *
 * @type {(s: _Scope, path: string) => (p: readonly [':', Operand, Operand] | readonly ['...', Operand]) => Document}
 */
const property = (s, path) => p => {
    if (p[0] === '...') { return mapOk(value => flat([['...'], value]))(operand(s, path)(p[1])) }
    const [, k, v] = p
    return typeof k !== 'string'
        ? error('an object key that is not a string')
        : mapOk(value => flat([keySerialize(k), colon, value]))(operand(s, path)(v))
}

/** A key in brackets, `[k]`, where no word follows a `.`. @type {(k: string | number) => Document} */
const bracketed = k => ok(flat([['['], leafSerialize(k), [']']]))

/**
 * An access's key: a name after `.` where the word admits it, and a key in
 * brackets otherwise. The `.` and the name are one chunk, so that a chunk
 * holding a name alone is always a reference — what {@link firstUse} reads.
 *
 * A number is written as itself, except for the three the tokenizer does not
 * read back to the same key: `NaN` and either infinity have no literal at
 * all, `Infinity` being an identifier and no key token, and `-0` reads back
 * as `0`. The front end produces none of them — `a[-0]` is already the key
 * `0` by the time a graph holds it — so each is refused rather than
 * respelled.
 *
 * A computed key, `['Number', e]`, is refused rather than written
 * `base[Number(k)]` as the issue proposes: the grammar's index is a string
 * or a number literal, so that spelling is one the parser would not read
 * back, and writing it would break the round trip the output exists for. It
 * is a spelling to add with computed keys, not before them.
 *
 * A method call's key is refused by the parser's other list: the member
 * functions a module may not call, `a.push(1)`, where `a.at(0)` is a call
 * though `a.at` is no read.
 *
 * @type {(method: boolean) => (k: Operand) => Document}
 */
const key = method => k => {
    if (typeof k === 'string') {
        if (method && _prohibitedCallNames.has(k)) { return error('a prohibited member function') }
        if (!method && _prohibitedNames.has(k)) { return error('a prohibited property name') }
        return identifierKey(k) ? ok([`.${k}`]) : bracketed(k)
    }
    if (typeof k !== 'number') { return error('an access key that is no literal') }
    return Number.isFinite(k) && !Object.is(k, -0)
        ? bracketed(k)
        : error('a number key no literal reads back')
}

/**
 * A guarded access's key, `?.k` or `?.[k]`: {@link key}'s text behind the
 * `?.`, which takes the place of a name's own `.`.
 *
 * @type {(method: boolean) => (k: Operand) => Document}
 */
const optionalKey = method => k => mapOk(
    /** @type {(text: List<string>) => List<string>} */
    (text => flat([[firstChunk(text).startsWith('.') ? '?' : '?.'], text])),
)(key(method)(k))

/** Whether the step after a key makes the key a call's: any step but a property. @type {(step: Step | undefined) => boolean} */
const isCallStep = step => step !== undefined && step[0] !== '|.'

/** The last of a chain's steps, or none. @type {(step: Step | undefined) => Step | undefined} */
const lastStep = step => step === undefined || step[2] === undefined ? step : lastStep(step[2])

/**
 * Whether a chain node's value is a property reference, a receiver live
 * at its end (`fjs/edag/README.md`, Chains): an access or a guarded access
 * with no step, and any chain whose last step is a property. A call over
 * such a node is the detached receiver, which no source spelling reaches
 * with the node written in place — `(a?.b)(c)` keeps the receiver — so
 * the writer names it first ({@link calleeHoisted}).
 *
 * @type {(node: Node) => boolean}
 */
const receiverLive = node => {
    if (node[0] !== '.' && node[0] !== '?.' && node[0] !== '?.()') { return false }
    const last = lastStep(node[3])
    return last === undefined ? node[0] !== '?.()' : last[0] === '|.'
}

/**
 * Whether a node opens a short-circuit region: a guarded access, a guarded
 * call, or an access whose step is a guarded call. A step written after
 * its text would read as the region's own, so where a `.` node or a call
 * stands over one, the writer groups it — `(a?.b).c` — which is where the
 * two graphs differ; a `?.` over one needs no group, `a?.b?.c` reading
 * back as the two nodes it is.
 *
 * @type {(node: Node | null) => boolean}
 */
const isRegion = node => node !== null && (node[0] === '?.' || node[0] === '?.()' || (node[0] === '.' && node.length === 4 && node[3][0] === '|?.()'))

/**
 * A base or a callee under a chain node, grouped where the node is a
 * region and the step over it is not guarded, {@link isRegion}.
 *
 * @type {(s: _Scope, path: string, optional: boolean) => (v: Operand) => Document}
 */
const chainBase = (s, path, optional) => v => mapOk(grouped(!optional && isRegion(nodeOf(s, v))))(base(s, path)(v))

/** The first chunk of a document, which no spelling leaves empty. @type {(text: List<string>) => string} */
const firstChunk = first('')

/**
 * The name the frame's slot `k` reads as in the scope `s`: the name the
 * slot took in the scope around the function. The slot exists, the index
 * is a canonical one, and the read is inside a function: the analysis's
 * `checked` refused every other before any text was written.
 *
 * @type {(s: _Scope) => (k: number) => string}
 */
const slotName = s => k => s.frame[k]

/** A read of the frame's slot `k`, written as its name. @type {(s: _Scope) => (k: number) => Document} */
const slotRead = s => k => ok([slotName(s)(k)])

/**
 * The names a function's slots read as, in the scope `s` the function is
 * written in: each slot's own name there — the `const` the hoisting walk
 * gave it, or the name of the slot of `s`'s frame it reads — and none for
 * a function that captures nothing.
 *
 * Slots the parser would not have built have no text that reads back as
 * the same graph, and are refused: a slot that holds a primitive — which
 * the parser writes into the body instead — or repeats another slot, since
 * one name is one capture.
 *
 * @type {(s: _Scope) => (slots: readonly Operand[]) => Result<readonly string[], string>}
 */
const frameNames = s => slots => {
    /** @type {(x: Operand) => Result<string, string>} */
    const name = x => {
        if (!(x instanceof Array)) { return error('a frame slot holding a primitive') }
        if (isSlotRead(s.a, x)) { return ok(slotName(s)(/** @type {number} */(s.a.nodes[x[1]][1]))) }
        // a slot holding the enclosing function's own `self` reads as the
        // name that function was bound to: the hoisting walk names every
        // function that reads its `self`, and the analysis refused one with
        // no function around it, so a missing name is this writer's own
        // mistake
        if (s.a.nodes[x[1]][0] === 'self') { return ok(assertNotNullish(s.self, ['a self in a scope with no name', x])) }
        const parameterRead = parameterName(s.param, s.a.nodes[x[1]])
        if (parameterRead !== null) { return ok(parameterRead) }
        // every other slot was hoisted before the statement holding the
        // function, so a missing name is this writer's own mistake
        return ok(assertNotNullish(nameOf(visible(s), ['entry', x[1]]), ['a frame slot that was not hoisted', x]))
    }
    return okThen(
        /** @type {(names: readonly string[]) => Result<readonly string[], string>} */
        (names => new Set(names).size === names.length ? ok(names) : error('a frame slot that repeats another')),
    )(okList(slots.map(name)))
}

/**
 * The order a function's body first reads its frame's slots in, which is
 * the order reading the text back numbers them: a chunk holding a name
 * alone is a reference ({@link key}), and the names of one frame are the
 * spellings of the scope around the body, which no name the body binds
 * shares ({@link hoistName}), so the first time the text holds a slot's name
 * is where the parser meets that capture.
 *
 * @type {(names: readonly string[], text: List<string>) => readonly number[]}
 */
const firstUse = (names, text) => toArray(text).reduce(
    /** @type {(order: readonly number[], chunk: string) => readonly number[]} */
    ((order, chunk) => {
        const i = names.indexOf(chunk)
        return i === -1 || order.includes(i) ? order : [...order, i]
    }),
    [])

/**
 * A function's body, over the names its frame's slots read as, in the text
 * that reads back to the same frame: the body as {@link lambdaBody} writes
 * it where its first reads of the slots come in slot order, and otherwise
 * {@link aliasedBody}, which puts them in that order first. The writer's
 * text order is its own — a shared function the body holds is hoisted above
 * the `return`, so what it reads comes first — and the frame's order is the
 * source's, so the two need not agree.
 *
 * Source output refuses a slot the body never reads: the parser builds
 * none, and no text reads back as one. Code-only function text keeps the
 * body's text in that case, with slot names unchanged and no extra reads.
 * Complete frames keep their existing canonical ordering in both outputs.
 *
 * @type {(a: Analysis, path: string, names: readonly string[], allowUnusedCaptures: boolean, self: string | null) => (b: Operand) => Document}
 */
const closureBody = (a, path, names, allowUnusedCaptures, self) => b => okThen(
    /** @type {(text: List<string>) => Document} */
    (text => {
        const order = firstUse(names, text)
        if (order.length !== names.length) {
            return allowUnusedCaptures ? ok(text) : error('a frame slot the body never reads')
        }
        return order.every((x, i) => x === i) ? ok(text)
            : aliasedBody(a, path, names, allowUnusedCaptures, self)(b)
    }),
)(lambdaBody(a, path, names, allowUnusedCaptures, self)(b))

/**
 * A function's body that opens by naming its frame's slots in slot order,
 * one `const` each, and reads each slot by that `const` from then on:
 *
 * ```js
 * (...$2)=>{const $3=$0;const $4=$1;const $5=()=>$4;return [$3,$5,$5];}
 * ```
 *
 * Read back, each `const` is the body's capture of that slot, taken in
 * order, and a reference to it is the slot's read again — an alias is the
 * node it names. It is anchored, as an unreached `const` is, only where no
 * eager position reaches it, and every position reaching a slot read is
 * eager in what this writer spells: a lazy operator is a node kind it has
 * none for.
 *
 * @type {(a: Analysis, path: string, names: readonly string[], allowUnusedCaptures: boolean, self: string | null) => (b: Operand) => Document}
 */
const aliasedBody = (a, path, names, allowUnusedCaptures, self) => b => {
    const aliases = names.map((_, i) => hoistName(path, i))
    /** @type {_Statement} */
    const start = {
        text: flat(names.map((name, i) => [`const ${binding(aliases[i])}=`, name, ';'])),
        names: aliases.map(alias => /** @type {const} */ ([null, alias])),
    }
    return okThen(
        /** @type {(all: _Root) => Document} */
        (all => mapOk(
            /** @type {(st: _Statement) => List<string>} */
            (st => flat([['{'], st.text, ['}']])),
        )(scope(bodyScope(a, path, aliases, b, allowUnusedCaptures, self), path, start)(all))),
    )(scopeOperands(a, b))
}

/**
 * The scope a function's body is written in, at `path`: no names around
 * it — a body reads the scope around it through its frame alone — its
 * frame's slot names, the parameter its arguments are written as, and
 * what its root reaches eagerly as its own to hoist.
 *
 * `self` is the name the body's function was bound to, which its `['self']`
 * reads as, or `null` for a function with no name.
 * @type {(a: Analysis, path: string, frame: readonly string[], b: Operand, allowUnusedCaptures: boolean, self: string | null) => _Scope}
 */
const bodyScope = (a, path, frame, b, allowUnusedCaptures, self) => ({ a, allowUnusedCaptures, outer: [], names: [], frame, param: path, eager: eagerFrom(a)(b), shared: a.shared, self, binding: null })

/** The scope a module is written in, over the names written so far. @type {(a: Analysis, names: _Names) => _Scope} */
const moduleScope = (a, names) => ({ a, allowUnusedCaptures: false, outer: [], names, frame: [], param: '', eager: eagerFrom(a)(a.root), shared: a.shared, self: null, binding: null })

/**
 * A function's body at `path`, in a scope of its own: the `const`s it needs
 * and then the value it returns.
 *
 * A body needing no `const` is the expression form, `=> v`, which is the
 * same function and the shorter text — unless its text opens with `{`, since
 * `=> {` opens a block and not an object. That question is the text's and
 * not the node's: an object literal is not the only body that begins with
 * one — `['.', ['{}', …], 'a']` writes `{"a":1}.a` — and a body that begins
 * with `{` any other way would need the same block. Grouping has since given
 * the language `=> ({"a":1})`, which is the same function in four fewer
 * characters; writing that instead is
 * [`./todo/parenthesized-object-body.md`](./todo/parenthesized-object-body.md).
 *
 * A body needing one is a block, `=> {const $n=…;return v;}`, which is
 * where a shared constructor inside a body, a numeric or function access
 * base, and a body's anchors are all written
 * ([spec: functions](../../../spec/README.md#functions)) — and so is a body
 * that throws, `=> {throw v;}`, the statement having no expression form.
 *
 * @type {(a: Analysis, path: string, frame: readonly string[], allowUnusedCaptures: boolean, self: string | null) => (b: Operand) => Document}
 */
const lambdaBody = (a, path, frame, allowUnusedCaptures, self) => b => {
    const s = bodyScope(a, path, frame, b, allowUnusedCaptures, self)
    return okThen(
        /** @type {(all: _Root) => Document} */
        (all => all.length === 1 && thrownValue(a, all[0]) === null && hoists(s)(all[0]).length === 0
            ? mapOk(
                /** @type {(text: List<string>) => List<string>} */
                (text => firstChunk(text).startsWith('{') ? flat([['{return '], text, [';}']]) : text),
            )(operand(s, path)(all[0]))
            : mapOk(
                /** @type {(st: _Statement) => List<string>} */
                (st => flat([['{'], st.text, ['}']])),
            )(scope(s, path, nothing)(all))),
    )(scopeOperands(a, b))
}

/**
 * A call's arguments, `(a,b)`: its item list, each argument any value, a
 * function included, and a spread one `...` before its operand.
 *
 * @type {(s: _Scope, path: string) => (args: readonly ItemOperand[]) => Document}
 */
const callArguments = (s, path) => args => mapOk(wrap('(')(')'))(okList(args.map((v, k) => item(s, `${path}/arg${k}`)(v))))

/**
 * An item inside a chain's region, an argument the chain's guard decides
 * to establish: a lazy operand, {@link lazyOperand}, a block where it
 * needs one and in place otherwise — never grouped, since an argument is
 * an `AssignmentExpression` as an array's item is.
 *
 * @type {(s: _Scope, path: string) => (v: ItemOperand) => Document}
 */
const lazyItem = (s, path) => v => v instanceof Array && v[0] === '...'
    ? mapOk(value => flat([['...'], value]))(lazyOperand(s, path, () => false)(v[1]))
    : lazyOperand(s, path, () => false)(/** @type {Operand} */(v))

/** A call's arguments inside a chain's region, each a {@link lazyItem}. @type {(s: _Scope, path: string) => (args: readonly ItemOperand[]) => Document} */
const lazyArguments = (s, path) => args => mapOk(wrap('(')(')'))(okList(args.map((v, k) => lazyItem(s, `${path}/arg${k}`)(v))))

/**
 * A chain's steps after the text before them, each applied to that text
 * — a property's key, judged as a method call's where a call follows it,
 * a call's arguments, a guarded call's behind `?.`, and the escaping call
 * around the whole text, `(a?.b)(c)`, since the group is what put it
 * outside the region. The arguments are lazy from the first guard on, the
 * guard's own included — `a.b?.(c)` establishes `c` only where `b` is not
 * nullish: a `.` node's own call, `a.b(c)`, is the one eager step, and the
 * only step such a node takes.
 *
 * @type {(s: _Scope, path: string, i: number, lazy: boolean) => (text: List<string>) => (step: Step | undefined) => Document}
 */
const chainSteps = (s, path, i, lazy) => text => step => {
    if (step === undefined) { return ok(text) }
    const [tag, x, next] = step
    // a guarded call's own arguments are inside the region it opens
    const guarded = lazy || tag === '|?.()'
    /** @type {(part: List<string>) => Document} */
    const rest = part => chainSteps(s, path, i + 1, guarded)(flat([text, part]))(next)
    if (tag === '|.') { return okThen(rest)(key(isCallStep(next))(x)) }
    const args = (guarded ? lazyArguments : callArguments)(s, `${path}/step${i}`)(x)
    if (tag === '|()') { return okThen(rest)(args) }
    if (tag === '|?.()') { return okThen(rest)(mapOk(/** @type {(a: List<string>) => List<string>} */ (a => flat([['?.'], a])))(args)) }
    return mapOk(/** @type {(a: List<string>) => List<string>} */ (a => flat([['('], text, [')'], a])))(args)
}

/**
 * A chain node's text: its base and key — a guarded access's key behind
 * `?.`, {@link optionalKey} — or its callee and the arguments of its
 * guarded call, and then its steps, {@link chainSteps}. The base is
 * grouped where it is a region of its own and this node is not guarded,
 * {@link chainBase}: `(a?.b).c` against `a?.b.c`, which is one node.
 *
 * @type {(s: _Scope, path: string) => (node: Extract<Node, readonly ['.' | '?.' | '?.()', ...unknown[]]>) => Document}
 */
const chain = (s, path) => node => {
    const [tag, b, x, k] = node
    const head = tag === '?.()'
        ? okList([chainBase(s, `${path}/callee`, true)(b), mapOk(/** @type {(a: List<string>) => List<string>} */ (a => flat([['?.'], a])))(lazyArguments(s, `${path}/arguments`)(/** @type {readonly ItemOperand[]} */ (x)))])
        : okList([chainBase(s, `${path}/base`, tag === '?.')(b), (tag === '?.' ? optionalKey : key)(isCallStep(k))(/** @type {Operand} */ (x))])
    return okThen(
        /** @type {(parts: readonly List<string>[]) => Document} */
        (parts => chainSteps(s, path, 0, tag !== '.')(flat(parts))(k)),
    )(head)
}

/**
 * Whether a callee takes a `const` of its own: a base that does
 * ({@link basedHoisted}), and an access, which a call would read as the
 * method call in any spelling — `a.b(c)` and `(a.b)(c)` alike — where the
 * graph calls what the access read. A function callee's `const` also keeps
 * a call with no arguments a call: the front end inlines `(()=>1)()` as `1`.
 *
 * @type {(a: Analysis, callee: Operand) => boolean}
 */
const calleeHoisted = (a, callee) => basedHoisted(a, callee)
    || (callee instanceof Array && receiverLive(a.nodes[callee[1]]))

/**
 * A function's parameter list, `($0,$1,...$2)=>`: one name per fixed
 * parameter, and the rest parameter only where the body reads it — `()=>1`
 * and not `(...$0)=>1`, the two being one node, and the shorter what a
 * reader expects. The function is entry `i`, and the body's nodes are the
 * ones its scope names.
 *
 * @type {(a: Analysis, path: string, i: number, length: number) => string}
 */
const parameterList = (a, path, i, length) => {
    const fixed = Array.from({ length }, (_, k) => binding(name(`${path}/arg${k}`)))
    const rest = a.nodes.some((n, j) => n[0] === 'rest' && a.scope[j] === i) ? [`...${binding(name(`${path}/rest`))}`] : []
    return `(${[...fixed, ...rest].join(',')})=>`
}

/**
 * The function that is entry `i`, of `length` fixed parameters, at `path`,
 * over the names its frame's slots read as: its parameter list, then its
 * body.
 *
 * `self` is the name the function was bound to, or `null`: a body reading
 * its own `['self']` needs one, and is refused without it.
 * @type {(a: Analysis, path: string, i: number, length: number, names: readonly string[], allowUnusedCaptures: boolean, self: string | null) => (body: Operand) => Document}
 */
const lambda = (a, path, i, length, names, allowUnusedCaptures, self) => body => readsSelf(a, i) && self === null
    ? error('a self-referencing function with no name')
    : mapOk(
        /** @type {(text: List<string>) => List<string>} */
        (text => flat([[parameterList(a, path, i, length)], text])),
    )(closureBody(a, path, names, allowUnusedCaptures, self)(body))

/**
 * One entry of the table, written in place — every entry that is not a
 * hoisted value of the scope it stands in, which {@link operand} named
 * before reaching here.
 *
 * @type {(s: _Scope, path: string) => (i: number) => Document}
 */
const entry = (s0, path) => i => {
    // the name the enclosing statement binds this entry to is the entry's
    // alone: what it holds is written in place, under no name
    const s = { ...s0, binding: null }
    const node = s.a.nodes[i]
    switch (node[0]) {
        case 'undefined': { return ok(['undefined']) }
        // the name the function was bound to: the hoisting walk gave one to
        // every function that reads its `self`, and the analysis refused a
        // `self` with no function around it
        case 'self': { return ok([assertNotNullish(s.self, ['a self in a scope with no name', i])]) }
        case 'arg': case 'rest': { return ok([assertNotNullish(parameterName(s.param, node))]) }
        case '[]': { return mapOk(arrayWrap)(okList(node[1].map((v, k) => item(s, `${path}/item${k}`)(v)))) }
        case '{}': { return mapOk(objectWrap)(okList(node[1].map((p, k) => property(s, `${path}/property${k}`)(p)))) }
        case 'frame': { return slotRead(s)(node[1]) }
        // an access and its method call, `a.b(c)`, which keeps `a` as the
        // receiver, and the optional chains, each with the steps it goes on
        // with ({@link chain})
        case '.': case '?.': case '?.()': { return chain(s, path)(node) }
        case '()': {
            // A callee that takes a `const` was named by the hoisting walk
            // ({@link calleeHoisted}); anything else is written in place, a
            // region grouped so that the call stays outside it.
            const [, callee, args] = node
            return mapOk(
                /** @type {(parts: readonly List<string>[]) => List<string>} */
                (parts => flat(parts)),
            )(okList([chainBase(s, `${path}/callee`, false)(callee), callArguments(s, `${path}/arguments`)(args)]))
        }
        case '=>': {
            const [, length, slots, body] = node
            return okThen(
                /** @type {(names: readonly string[]) => Document} */
                (names => lambda(s.a, `${path}/function${i}`, i, length, names, s.allowUnusedCaptures, s0.binding)(body)),
            )(frameNames(s)(slots))
        }
        // `op12` of one operand is the prefix, and of two the binary minus
        case '-': {
            const [op, left, right] = node
            return right === undefined ? prefix(s, path)(op)(left) : binary(s, path)(op, left, right)
        }
        // and `+` of one operand is the unary plus, which the language has
        // no spelling for
        case '+': {
            const [op, left, right] = node
            return right === undefined ? error('a unary + node') : binary(s, path)(op, left, right)
        }
        case '~': case '!': case 'typeof': { return prefix(s, path)(node[0])(node[1]) }
        // the conversion is spelled as the call it is in JavaScript, its
        // operand an argument, which takes no parentheses of its own
        case 'Number': {
            return mapOk(
                /** @type {(text: List<string>) => List<string>} */
                (text => flat([['Number'], text])),
            )(callArguments(s, `${path}/operand`)([node[1]]))
        }
        case '|': case '^': case '&': case '===': case '!==': case '<': case '<=': case '>': case '>=':
        case '<<': case '>>': case '>>>': case '*': case '/': case '%': case '**': { return binary(s, path)(node[0], node[1], node[2]) }
        case '&&': case '||': case '??': { return lazyBinary(s, path)(node) }
        case '?:': { return conditional(s, path)(node) }
        // a comma is a block's own form, read by `scopeOperands` where a
        // module's root, a function's body or a lazy operand begins;
        // anywhere else it has no source spelling until the operator lands
        case ',': { return error('a comma outside a scope') }
        // a `throw` where a scope ends is `statement`'s, the statement it
        // came from; anywhere else it is the call of a function that throws,
        // JavaScript's one spelling of an expression that fails
        case 'throw': {
            return mapOk(
                /** @type {(text: List<string>) => List<string>} */
                (text => flat([['(()=>{throw '], text, [';})()']])),
            )(operand(s, path)(node[1]))
        }
        default: { return error(`a ${node[0]} node`) }
    }
}

/**
 * The values a statement has to hoist before it can be written, in the
 * order their `const`s come: every hoisted value its operand reaches that
 * this scope owns — an entry its block's root reaches eagerly, `s.eager`
 * — and the names do not hold yet, each after the hoisted values it
 * reaches itself, which is the table's own order since an entry follows
 * its operands.
 *
 * The walk enters a lazy operand, since a value it holds may be reached
 * eagerly from elsewhere in the scope, in this statement or a later one,
 * and then is the scope's to name before either; what only the operand
 * reaches is not this scope's — it is hoisted in the operand's own block
 * ({@link block}), when the operand is written.
 *
 * A body is not walked: nothing inside one is hoisted, because a `const`
 * at the module level would leave the body's scope.
 *
 * @type {(s: _Scope) => (v: Operand) => readonly _Hoisted[]}
 */
const hoists = s => {
    /** @type {(i: number) => boolean} */
    const own = i => s.eager.includes(i)
    /** @type {(found: readonly _Hoisted[], v: Operand) => readonly _Hoisted[]} */
    const found = (names, v) => {
        /** @type {(ns: readonly _Hoisted[], h: _Hoisted) => readonly _Hoisted[]} */
        const add = (ns, h) =>
            slotOf(visible(s), h) === null && !ns.some(n => sameHoisted(n, h)) ? [...ns, h] : ns
        if (!(v instanceof Array)) { return names }
        const i = v[1]
        if (slotOf(visible(s), ['entry', i]) !== null) { return names }
        const node = s.a.nodes[i]
        // every slot but a parameter and a read of this scope's own frame
        // takes a `const`, after what it reaches and before the function: a
        // capture is a name, and those two have one
        const inner = (node[0] === '=>' ? node[2] : [])
            .filter(x => x instanceof Array && !isName(s.a, x))
            .reduce((ns, x) => own(/** @type {Ref} */(x)[1]) ? add(found(ns, /** @type {Ref} */(x)), ['entry', /** @type {Ref} */(x)[1]]) : found(ns, /** @type {Ref} */(x)),
                [...operands(node), ...lazyOperands(node)].reduce(found, names))
        // a base or a callee that takes a `const` takes it before the node
        // does, since a call is shared by its own `const`, which reads it
        const named = ((node[0] === '.' || node[0] === '?.') && basedHoisted(s.a, node[1])) || ((node[0] === '()' || node[0] === '?.()') && calleeHoisted(s.a, node[1]))
        const based = named && own(i)
            ? add(inner, node[1] instanceof Array ? ['entry', node[1][1]] : ['leaf', /** @type {number | bigint} */(node[1])])
            : inner
        // a function reading its own `self` takes a `const` however many
        // places hold it: only a name gives its body a way to reach it
        return ((hoistedKind(s.a, i) && s.shared.includes(i)) || (node[0] === '=>' && readsSelf(s.a, i))) && own(i) ? add(based, ['entry', i]) : based
    }
    return v => found(/** @type {readonly _Hoisted[]} */([]), v)
}

/**
 * The eager operands a node holds, for the hoisting walk and the module
 * writer: a container's items and a property's halves, an access's base
 * and key, a call's callee and each argument, a prefix's operand, a
 * conversion's, an eager
 * binary operator's two, a `throw`'s value, a comma's operands, a lazy
 * operator's left operand and a conditional's condition. A function's body
 * is not among them, since the walk stops at a body, and neither is its
 * frame, which the walk reads on its own.
 *
 * @type {(node: Node) => readonly Operand[]}
 */
const operands = node => {
    switch (node[0]) {
        case '.': { return [node[1], node[2], ...(node.length === 3 || node[3][0] !== '|()' ? [] : node[3][1].map(itemOperand))] }
        case '()': { return [node[1], ...node[2].map(itemOperand)] }
        // a guarded access's base, and a guarded call's callee: what the
        // guard tests, established whatever it decides
        case '?.': case '?.()': { return [node[1]] }
        case '[]': { return node[1].map(itemOperand) }
        case '{}': { return node[1].flatMap(p => p[0] === '...' ? [p[1]] : [p[1], p[2]]) }
        case 'throw': case '~': case '!': case 'typeof': case 'Number': { return [node[1]] }
        case '-': case '+': { return node.length === 2 ? [node[1]] : [node[1], node[2]] }
        case ',': { return node[1] }
        case '&&': case '||': case '??': case '?:': { return [node[1]] }
        case '|': case '^': case '&': case '===': case '!==': case '<': case '<=': case '>': case '>=':
        case '<<': case '>>': case '>>>': case '*': case '/': case '%': case '**': { return [node[1], node[2]] }
        default: { return [] }
    }
}

/**
 * The operands a node establishes only when it decides to — the right
 * operand of `&&`, `||` and `??`, the arms of `?:` — each a block root.
 *
 * @type {(node: Node) => readonly Operand[]}
 */
const lazyOperands = node => {
    switch (node[0]) {
        case '&&': case '||': case '??': { return [node[2]] }
        case '?:': { return [node[2], node[3]] }
        // a chain's region: a guarded access's key and every step after
        // it, a guarded call's arguments and its steps, and the steps after
        // an access's guarded call — the operands a nullish value skips
        case '.': { return node.length === 4 && node[3][0] === '|?.()' ? stepOperands(node[3]) : [] }
        case '?.': { return [node[2], ...stepOperands(node[3])] }
        case '?.()': { return [...node[2].map(itemOperand), ...stepOperands(node[3])] }
        default: { return [] }
    }
}

/**
 * Every operand a node holds in its own scope, eager or lazy, the operands
 * this writer has no spelling for included, so that a reach over the graph
 * is the graph's and not the spelling's: a function's slots, and not its
 * body, which is a scope of its own.
 *
 * @type {(node: Node) => readonly Operand[]}
 */
const allOperands = node => node[0] === '=>' ? node[2] : operandsOf(node)

/** The eager operands among {@link allOperands}: all but the lazy ones. @type {(node: Node) => readonly Operand[]} */
const eagerOperands = node => allOperands(node).filter(x => !lazyOperands(node).includes(x))

/**
 * The entries a block root reaches eagerly, in walk order: through eager
 * positions alone, never through a lazy operand, and never into a function
 * body. What a scope's statements may hoist, since a `const` there
 * establishes exactly these.
 *
 * @type {(a: Analysis) => (root: Operand) => readonly number[]}
 */
const eagerFrom = a => root => {
    /** @type {(seen: readonly number[], v: Operand) => readonly number[]} */
    const reach = (seen, v) => v instanceof Array && !seen.includes(v[1])
        ? eagerOperands(a.nodes[v[1]]).reduce(reach, [...seen, v[1]])
        : seen
    return reach([], root)
}

/**
 * The entries an operand reaches through any edge in its own scope, in
 * walk order, entering only the entries `through` admits, the operand's
 * own among them: the walk stops at any other, neither listing it nor
 * reaching under it.
 *
 * @type {(a: Analysis, through: (i: number) => boolean) => (root: Operand) => readonly number[]}
 */
const reachableThrough = (a, through) => root => {
    /** @type {(seen: readonly number[], v: Operand) => readonly number[]} */
    const reach = (seen, v) => v instanceof Array && !seen.includes(v[1]) && through(v[1])
        ? allOperands(a.nodes[v[1]]).reduce(reach, [...seen, v[1]])
        : seen
    return reach([], root)
}

/** Every entry an operand reaches in its own scope: {@link reachableThrough}, admitting all. @type {(a: Analysis) => (root: Operand) => readonly number[]} */
const reachableFrom = a => reachableThrough(a, () => true)

/**
 * How many places under `root`, in its own scope, hold the entry `i` —
 * the root's own place where it is `i`, and every edge into it under the
 * root, eager or lazy, counted once per place.
 *
 * @type {(a: Analysis, root: Operand, i: number) => number}
 */
const referencesWithin = (a, root, i) => {
    /** @type {(state: readonly [readonly number[], number], v: Operand) => readonly [readonly number[], number]} */
    const count = ([seen, n], v) => {
        if (!(v instanceof Array) || seen.includes(v[1])) { return [seen, n] }
        const held = allOperands(a.nodes[v[1]])
        return held.reduce(count, [[...seen, v[1]], n + held.filter(x => x instanceof Array && x[1] === i).length])
    }
    return count([[], root instanceof Array && root[1] === i ? 1 : 0], root)[1]
}

/**
 * The entries written at more than one place under an operand, the operand
 * itself written once: reached by more than one edge, or through an entry
 * itself written at more than one place — the analysis's own rule for
 * `shared`, over the operand's subgraph alone, since a block's root is
 * written once whatever holds it: the sharing the scope around the block
 * counts through the node holding the operand is that node's, kept in a
 * `const` there ({@link hoistedKind}), and is not counted again inside.
 *
 * Each entry is met after every entry holding it, an entry following its
 * operands in the table, so its count is final by the time its own
 * operands are counted through it.
 *
 * @type {(a: Analysis) => (root: Operand) => readonly number[]}
 */
const sharedWithin = a => root => {
    if (!(root instanceof Array)) { return [] }
    /** @type {(counts: readonly (readonly [number, number])[], i: number, n: number) => readonly (readonly [number, number])[]} */
    const bump = (counts, i, n) => counts.some(([j]) => j === i)
        ? counts.map(([j, m]) => /** @type {readonly [number, number]} */ ([j, j === i ? m + n : m]))
        : [...counts, /** @type {readonly [number, number]} */ ([i, n])]
    const counts = reachableFrom(a)(root).toSorted((x, y) => y - x).reduce(
        /** @type {(counts: readonly (readonly [number, number])[], p: number) => readonly (readonly [number, number])[]} */
        ((counts, p) => {
            // every entry but the root was counted through the entry
            // holding it before this, so a missing count is this walk's
            // own mistake
            const places = assertNotNullish(counts.find(([j]) => j === p), ['an entry reached before what holds it', p])[1]
            return allOperands(a.nodes[p]).reduce((cs, c) => c instanceof Array ? bump(cs, c[1], places) : cs, counts)
        }),
        [[root[1], 1]])
    return counts.filter(([, n]) => n >= 2).map(([i]) => i)
}

/**
 * How many places in the whole table hold the entry `i` as an operand. The
 * root's own place is not among them, and need not be: what is asked
 * about is a value under a lazy operand ({@link block}), which the root
 * never is.
 *
 * @type {(a: Analysis, i: number) => number}
 */
const references = (a, i) => a.nodes.flatMap(allOperands).filter(x => x instanceof Array && x[1] === i).length

/** The text a hoisted value's `const` holds, in the scope at `path`. @type {(s: _Scope, path: string) => (h: _Hoisted) => Document} */
const hoistedText = (s, path) => h => h[0] === 'leaf'
    ? ok(leafSerialize(h[1]))
    : entry(s, path)(h[1])

/**
 * One statement and every `const` it needed first: the hoists, in order,
 * then the operand itself — an anchor as a `const` of its own, and the last
 * operand as the export or the `return` — or, where that operand is a
 * `throw` node, as the `throw` statement it came from, the value after the
 * keyword ([spec: functions](../../../spec/README.md#functions)).
 *
 * An anchor that is itself a value the statement's own hoists named — a
 * shared constructor the scope reaches only lazily, `const c = [];
 * export default [a && c, b && c];` — is that `const`, which the front end
 * reads back as anchored exactly because no other operand of the comma
 * reaches it eagerly, `elsewhere`, so the statement writes nothing more.
 * Where one does, the `const` reads back as reached and the anchor is
 * lost, so the anchor is refused, as one whose operand had a name already
 * is, and one that is a name of the scope's own — the arguments, a
 * parameter, a slot of the frame. Its statement would be a bare alias,
 * `const $1=$0;`, which the front end reads back as nothing at all — an
 * alias is the node it names, not an anchored computation — and the comma
 * would be lost with it. Linking emits no such graph: it anchors nothing
 * another operand establishes, and drops the alias where the source
 * writes one.
 *
 * An anchor's `const` names its node for the statements after it where no
 * other operand reaches the node eagerly: a later read of it is lazy then,
 * a function's capture under a lazy operand among them, so the front end
 * still reads the `const` back as the anchor, and the node is not written
 * a second time — `const $1=$0[0]+1;return true?()=>$1:1;`, where a
 * second `const` would read back as a second anchor. A node another
 * operand reaches eagerly is written where it is read, as the graph
 * establishes it there.
 *
 * @type {(s0: _Scope, path: string, last: boolean, elsewhere: readonly number[]) => (before: _Statement, v: Operand) => Result<_Statement, string>}
 */
const statement = (s0, path, last, elsewhere) => ({ text, names }, v) => {
    /** @type {(acc: Result<_Statement, string>, h: _Hoisted) => Result<_Statement, string>} */
    const emit = (acc, h) => {
        if (acc[0] === 'error') { return acc }
        const before = acc[1]
        const s = { ...s0, names: before.names, binding: hoistName(path, before.names.length) }
        return mapOk(
            /** @type {(value: List<string>) => _Statement} */
            (value => ({
                text: flat([before.text, [`const ${binding(hoistName(path, before.names.length))}=`], value, [';']]),
                names: [...before.names, [h, hoistName(path, before.names.length)]],
            })),
        )(hoistedText(s, `${path}/statement${before.names.length}`)(h))
    }
    const namedBefore = v instanceof Array && slotOf(visible({ ...s0, names }), ['entry', v[1]]) !== null
    const hoisted = hoists({ ...s0, names })(v).reduce(emit, ok({ text, names }))
    if (hoisted[0] === 'error') { return hoisted }
    const before = hoisted[1]
    const s = { ...s0, names: before.names }
    if (!last && v instanceof Array && slotOf(visible(s), ['entry', v[1]]) !== null) {
        return namedBefore || elsewhere.includes(v[1]) ? error('an anchor that repeats a hoisted value') : ok(before)
    }
    if (!last && isName(s.a, v)) { return error('an anchor that is a name') }
    const thrown = last ? thrownValue(s.a, v) : null
    const lead = thrown !== null ? 'throw ' : last ? (path === 'module' ? 'export default ' : 'return ') : `const ${binding(hoistName(path, before.names.length))}=`
    const written = thrown === null ? v : thrown[0]
    return mapOk(
        /** @type {(value: List<string>) => _Statement} */
        (value => ({
            text: flat([before.text, [lead], value, [';']]),
            names: last ? before.names : [...before.names, [v instanceof Array && !elsewhere.includes(v[1]) ? ['entry', v[1]] : null, hoistName(path, before.names.length)]],
        })),
    )(operand(s, `${path}/statement${before.names.length}`)(written))
}

/**
 * The statements of one scope: each operand preceded by the `const`s it
 * needs, an anchor as a `const` of its own, and the last operand introduced
 * by what the scope returns with — `export default ` for a module, `return `
 * for a function body.
 *
 * The names start empty, a scope's `const`s being its own: a body reads a
 * name the scope around it bound through its frame alone, `frame` naming
 * each slot.
 *
 * `start` is what the scope has written before them: nothing, or a body's
 * aliases of its frame ({@link aliasedBody}). Each statement is told what
 * the other operands reach eagerly, which decides whether an anchor that
 * is a shared value survives reading back ({@link statement}).
 *
 * @type {(s: _Scope, path: string, start: _Statement) => (all: _Root) => Result<_Statement, string>}
 */
const scope = (s, path, start) => all => {
    /** @type {(acc: Result<_Statement, string>, v: Operand, i: number) => Result<_Statement, string>} */
    const step = (acc, v, i) => acc[0] === 'error'
        ? acc
        : statement(s, path, i === all.length - 1, all.flatMap((w, j) => j === i ? [] : eagerFrom(s.a)(w)))(acc[1], v)
    return all.reduce(step, ok(start))
}

/** A scope that has written nothing yet. @type {_Statement} */
const nothing = { text: null, names: [] }

/**
 * The operands a scope's statements are written from: a comma is the source
 * form it came from, an unused `const` per anchor and then the value, and
 * any other operand is that value alone.
 *
 * A comma holding fewer than two operands is refused: an anchor is an
 * unreached `const`, so a comma with one operand has no anchor to write and
 * would be read back as its operand alone, and one with none is no scope at
 * all. Linking emits neither, at a module's root or in a body — a comma is
 * built only where an anchor or an unbound import is there to carry.
 *
 * @type {(a: Analysis, v: Operand) => Result<_Root, string>}
 */
const scopeOperands = (a, v) => {
    if (!(v instanceof Array)) { return ok([v]) }
    const node = a.nodes[v[1]]
    if (node[0] !== ',') { return ok([v]) }
    return node[1].length < 2
        ? error('a comma with fewer than two operands')
        : ok(node[1])
}

/**
 * A linked EDAG as the chunks of a FunctionalScript module, or why this
 * writer has no spelling for it.
 *
 * @type {(e: Exp) => Document}
 */
export const trySerialize = e => {
    const result = okThen(checked)(analysis(e))
    const [kind, a] = result
    if (kind === 'error') { return result }
    return okThen(
        /** @type {(all: _Root) => Document} */
        (all => mapOk(
            /** @type {(s: _Statement) => List<string>} */
            (s => resolve(toArray(s.text))),
        )(scope(moduleScope(a, []), 'module', nothing)(all))),
    )(scopeOperands(a, a.root))
}

/** The same as one string. @type {(e: Exp) => Result<string, string>} */
export const tryStringify = e => mapOk(
    /** @type {(text: List<string>) => string} */
    (text => toArray(text).join('')),
)(trySerialize(e))

/**
 * A function entry's canonical text from an existing analysis table. The
 * caller supplies a function index with valid length and body bindings,
 * including nested body scopes. Analysis and admission belong to the caller;
 * this renderer trusts those invariants and renders every admitted body.
 *
 * Captures are named by position, `$0`, `$1`, …, without rendering their
 * values. Primitive, repeated and unused evaluated captures are allowed.
 * Nested functions may also leave slots unused. Slot positions and capture
 * evaluation are preserved, and unused slots add no reads to the text.
 * The selected function is written as a standalone expression even when it
 * is nested in the table. Source expression forms are retained. Bodies the
 * source writer cannot reconstruct use a complete JavaScript expression
 * spelling, with lazy memo thunks where sharing crosses lazy branches. This
 * code-only text is neither a closed callable nor a source round-trip promise.
 * {@link tryFunctionText} is the checked entry for a raw expression.
 *
 * @type {(a: Analysis, i: number) => string}
 */
export const functionText = (a, i) => {
    const [, length, slots, body] = /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])
    const frame = slots.map((_, k) => name(`external${k}`))
    const [kind, text] = lambda(a, 'function', i, length, frame, true, null)(body)
    return kind === 'ok' ? resolve(toArray(text), [], frame).join('') : renderFunction(a, i)
}

/**
 * A function's text: the function node written as one expression — what
 * `String(f)` answers for a function the compiler built, and the one
 * spelling every executor shares
 * ([spec: function source](../../../spec/README.md#function-source-representation-exception)).
 *
 * ```js
 * ()=>1
 * ($0,...$1)=>$0+$1.length
 * ()=>{const $0=[];return [$0,$0];}
 * ```
 *
 * The text is the code's, not the value's: a captured value is written as
 * the name of its slot, `$0`, `$1`, …, so every function one arrow makes has
 * one text, as it has in JavaScript — `make(0)` and `make(1)` alike, for
 * `const make = x => () => [x];` read as `()=>[$0]`. That answers the
 * serialization spec's question 2 as code-only
 * ([`spec/todo/serialization.md`](../../../spec/todo/serialization.md#open-questions));
 * rendering the captured values instead is a text for the same node with
 * each name replaced, which this spelling leaves room for.
 *
 * A primitive the source captured is no slot: the lowering wrote it into
 * the body, so `const x = 3; const f = () => x;` is `()=>3`.
 *
 * Refuses invalid bindings, metadata and nodes that are not functions.
 * Analyze the complete graph once to refuse capture/body sharing
 * across scopes, then check and render the function's body from that table.
 * Capture bindings belong to the enclosing scope and are not checked here.
 *
 * @type {(e: Exp) => Result<string, string>}
 */
export const tryFunctionText = e => {
    if (!(e instanceof Array) || e[0] !== '=>') { return error('not a function') }
    const result = analysis(e)
    const [kind, a] = result
    if (kind === 'error') { return result }
    const i = /** @type {Ref} */ (a.root)[1]
    return mapOk((/** @type {Analysis} */ table) => functionText(table, i))(checked(a, i))
}

/** Emit one named value using the same expression writer as value output. @type {(a: Analysis, h: _Hoisted) => (before: _Statement) => Result<_Statement, string>} */
const moduleBinding = (a, h) => before => {
    const symbol = hoistName('module', before.names.length)
    return mapOk(
        /** @type {(text: List<string>) => _Statement} */
        (text => ({ text: flat([before.text, [`const ${binding(symbol)}=`], text, [';']]), names: [...before.names, [h, symbol]] })),
    )(hoistedText({ ...moduleScope(a, before.names), binding: symbol }, 'module')(h))
}

/**
 * Evaluate a module operand in graph order and name it once. Commas become
 * ordered declarations and an alias of their last operand. Function bodies
 * stay in the existing scope writer; no value is hoisted out of a function.
 *
 * @type {(a: Analysis) => (before: _Statement, v: Operand) => Result<_Statement, string>}
 */
const moduleOperand = a => (before, v) => {
    if (!(v instanceof Array) || slotOf(before.names, ['entry', v[1]]) !== null) { return ok(before) }
    const node = a.nodes[v[1]]
    if (node[0] === ',' && node[1].length < 2) { return error('a comma with fewer than two operands') }
    const children = operands(node).reduce(
        /** @type {(acc: Result<_Statement, string>, child: Operand) => Result<_Statement, string>} */
        ((acc, child) => okThen(state => moduleOperand(a)(state, child))(acc)), ok(before))
    return okThen(state => {
        if (node[0] === ',') {
            const last = node[1][node[1].length - 1]
            const symbol = hoistName('module', state.names.length)
            return mapOk(
                /** @type {(text: List<string>) => _Statement} */
                (text => ({ text: flat([state.text, [`const ${binding(symbol)}=`], text, [';']]), names: [...state.names, [['entry', v[1]], symbol]] })),
            )(operand(moduleScope(a, state.names), 'module')(last))
        }
        const prepared = hoists(moduleScope(a, state.names))(v).reduce(
            /** @type {(acc: Result<_Statement, string>, h: _Hoisted) => Result<_Statement, string>} */
            ((acc, h) => okThen(moduleBinding(a, h))(acc)), ok(state))
        return okThen(ready => slotOf(ready.names, ['entry', v[1]]) !== null
            ? ok(ready)
            : moduleBinding(a, ['entry', v[1]])(ready))(prepared)
    })(children)
}

/** @type {(a: Analysis, v: Operand) => readonly (readonly [':', string, Operand])[]} */
const exportOperands = (a, v) => {
    const node = a.nodes[/** @type {Ref} */ (v)[1]]
    return node[0] === ','
        ? exportOperands(a, node[1][node[1].length - 1])
        : /** @type {readonly (readonly [':', string, Operand])[]} */ (/** @type {Extract<Node, readonly ['{}', unknown]>} */ (node)[1])
}

/** Evaluate a module's sequence and exports without constructing a discarded namespace. @type {(a: Analysis) => (state: _Statement, v: Operand) => Result<_Statement, string>} */
const moduleBody = a => (state, v) => {
    const node = a.nodes[/** @type {Ref} */ (v)[1]]
    const values = node[0] === ',' ? node[1].slice(0, -1) : exportOperands(a, v).map(([, , value]) => value)
    const before = values.reduce(
        /** @type {(acc: Result<_Statement, string>, value: Operand) => Result<_Statement, string>} */
        ((acc, value) => okThen(s => moduleOperand(a)(s, value))(acc)), ok(state))
    return node[0] === ','
        ? okThen(s => moduleBody(a)(s, node[1][node[1].length - 1]))(before)
        : before
}

/** One original export, after its computation has been emitted. @type {(a: Analysis, state: _Statement) => (member: readonly [':', string, Operand]) => Document} */
const moduleExport = (a, state) => ([, key, v]) => mapOk(
    /** @type {(text: List<string>) => List<string>} */
    (text => flat([[key === 'default' ? 'export default ' : `export const ${key}=`], text, [';']])),
)(operand(moduleScope(a, state.names), 'module')(v))

/**
 * A module export object as source, preserving export names and declaration
 * evaluation. The compact value writer keeps default-only DataJS fixed points;
 * the module walk also handles dependencies whose selected export retains an
 * internal evaluation sequence.
 *
 * @type {(e: Exp) => Document}
 */
export const tryModuleSerialize = e => {
    // a module that throws exports nothing: its computation is the one
    // statement the value writer spells, `throw v;`, in place of the exports
    if (_moduleThrows(e)) { return trySerialize(e) }
    const members = _moduleExports(e)
    if (members.length === 0) { return error('a module without exports') }
    const keys = members.map(([, key]) => key)
    if (new Set(keys).size !== keys.length) { return error('duplicate export names') }
    if (keys.some(key => key !== 'default' && (!identifierKey(key) || reservedExports.has(key)))) {
        return error('an unsupported export name')
    }
    if (keys.length === 1 && keys[0] === 'default') {
        const compact = trySerialize(_defaultExport(e))
        if (compact[0] === 'ok') { return compact }
    }
    const result = okThen(checked)(analysis(e))
    const [kind, a] = result
    if (kind === 'error') { return result }
    const exports = exportOperands(a, a.root)
    return okThen(state => mapOk(
        /** @type {(parts: readonly List<string>[]) => List<string>} */
        (parts => resolve(toArray(flat([state.text, ...parts])), keys)),
    )(okList([
        ...exports.filter(([, key]) => key !== 'default'),
        ...exports.filter(([, key]) => key === 'default'),
    ].map(moduleExport(a, state)))))(moduleBody(a)({ text: null, names: [] }, a.root))
}

/** The module source as one string. @type {(e: Exp) => Result<string, string>} */
export const tryModuleStringify = e => mapOk(
    /** @type {(text: List<string>) => string} */
    (text => toArray(text).join('')),
)(tryModuleSerialize(e))
