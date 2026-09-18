/**
 * The FunctionalScript writer, claim by claim.
 *
 * Every graph that has a spelling is checked twice: the text itself, so the
 * output is pinned rather than merely round-tripping, and the graph the
 * front end reads back out of that text, so the output is FunctionalScript
 * and not only a string. The second check goes through `parse` and
 * `unresolved`, the front end's own two halves, which is what makes it the
 * compiler's answer rather than a second writer's; the graphs are compared
 * as their tables, since that is what a round trip preserves — the names and
 * the places a value is written are the writer's to choose.
 *
 * A refusal is checked by its message, since a message is what a user of the
 * compiler meets, and every one of them names a feature that will replace it.
 *
 * @import { Exp } from '../../edag/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { invert, unwrap } from '../../types/result/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { trySerialize, tryStringify } from './module.f.mjs'
import { keywords } from '../../js/keywords/module.f.mjs'

/** The name the front end gives the text it reads back. */
const path = '/proof.f.js'

/**
 * The text the writer writes for a graph, once the front end has read it
 * back to the same table. A module of the writer's own making imports
 * nothing, so `unresolved` needs no resolution to hand back its graph.
 *
 * @type {(e: Exp) => string}
 */
const reads = e => {
    const text = unwrap(tryStringify(e))
    const { imports, edag } = unresolved(unwrap(parse(path)(text)))
    assertEq(imports.length, 0, text)
    assertStructurallySame(analysis(edag), analysis(e), text)
    return text
}

/** That, and the text. @type {(e: Exp, expected: string) => void} */
const writes = (e, expected) => { assertEq(reads(e), expected) }

/** Why the writer has no spelling for a graph, with nothing written. @type {(e: Exp, expected: string) => void} */
const refuses = (e, expected) => { assertEq(unwrap(invert(tryStringify(e))), expected) }

/** `(...a) => ... => a`, `n` bodies deep. @type {(n: number) => Exp} */
const nested = n => n === 0 ? ['args'] : ['=>', null, nested(n - 1)]

/** `(...a) => a`, the graph a spelling is wanted for rather than read from. @type {Exp} */
const identity = ['=>', null, ['args']]

/**
 * The keys a generated access is given: a word that follows `.`, a number,
 * the one prototype name an access may read, one it may not, a word that
 * denotes a value, and a letter that is no letter.
 *
 * @type {readonly (string | number)[]}
 */
const keys = ['a', 0, 'length', 'constructor', 'true', '\u212a']

/** Every array rebuilt, every leaf as it stands. @type {(x: unknown) => unknown} */
const deep = x => x instanceof Array ? x.map(deep) : x

/** A structural copy: the same graph, sharing no node with the original. @type {(e: Exp) => Exp} */
const copy = e => /** @type {Exp} */ (deep(e))

/**
 * One graph per shape over the graphs `p`: each container, an access with
 * each key, a function body, a node shared twice, each side of a root
 * comma, a root comma whose two sides are one node, a root comma with one
 * operand, and the same graph twice over in two scopes.
 *
 * That last one is a copy and not the node again: two nodes, one in a body
 * and one outside it, which is a graph the compiler emits — and which the
 * writer has to spell so that reading it back gives two nodes again, since
 * one node in two scopes is no EDAG and the analysis refuses it.
 *
 * A shared node is duplicated within one container, never across a `=>`, so
 * a later shape that wraps it in a body takes both occurrences with it —
 * the EDAG's scope rule is about a node reached from two scopes, and these
 * graphs never build one.
 *
 * @type {(p: readonly Exp[]) => readonly Exp[]}
 */
const shapes = p => [
    ...p.map(x => /** @type {Exp} */(['[]', [x]])),
    ...p.map(x => /** @type {Exp} */(['{}', [[':', 'k', x]]])),
    ...p.flatMap(x => keys.map(k => /** @type {Exp} */(['.', x, k]))),
    ...p.map(x => /** @type {Exp} */(['=>', null, x])),
    ...p.map(x => /** @type {Exp} */(['[]', [x, x]])),
    ...p.map(x => /** @type {Exp} */([',', [x, 1]])),
    ...p.map(x => /** @type {Exp} */([',', [['[]', []], x]])),
    ...p.map(x => /** @type {Exp} */([',', [x, x]])),
    ...p.map(x => /** @type {Exp} */([',', [x]])),
    ...p.map(x => /** @type {Exp} */(['[]', [x, ['=>', null, copy(x)]]])),
]

/**
 * Every leaf, the arguments, both empty containers, `undefined`, and a
 * negation — the one operator, whose operand binds tighter than it does, so
 * every shape below has to say where the negation happens.
 *
 * @type {readonly Exp[]}
 */
const atoms = [1, 'a', null, true, 1n, ['args'], ['[]', []], ['{}', []], ['undefined'], ['-', ['[]', []]]]

/** The atoms and two rounds of shapes over them. @type {readonly Exp[]} */
const generated = (() => {
    const one = shapes(atoms)
    return [...atoms, ...one, ...shapes(one)]
})()

export const proof = {
    // A module is one line and one statement when nothing is shared: the
    // export, its value spelled where it stands. The leaves are the DataJS
    // serializer's, this writer owning none of their spelling.
    leaves: () => {
        writes(1, 'export default 1;')
        writes('x', 'export default "x";')
        writes(['undefined'], 'export default undefined;')
        writes(['[]', []], 'export default [];')
        writes(['{}', []], 'export default {};')
        writes(
            ['[]', [null, true, false, 1, 1.5, 1n, 'a"b', '\u{1f600}']],
            'export default [null,true,false,1,1.5,1n,"a\\"b","\u{1f600}"];')
        writes(['{}', [[':', 'a', 1], [':', 'b', 2], [':', '', 3]]], 'export default {"a":1,"b":2,"":3};')
    },
    // The one operator. `-` binds looser than a step, so a negation under an
    // access is a base the text cannot say without a name — `-1[0]` is
    // `-(1[0])` — and a negated function is no `UnaryExpression`, so it
    // takes a name too. `op12` of two operands is the binary minus, which
    // the language has no spelling for yet.
    neg: () => {
        writes(['-', ['[]', [1]]], 'export default -[1];')
        writes(['-', 'a'], 'export default -"a";')
        // `- -1` and not `--1`, which is the decrement token. The operand
        // here is a container, since a negated *literal* has no text
        writes(['-', ['-', ['[]', []]]], 'export default - -[];')
        // the negation is inside the access, which is where the text puts it
        writes(['-', ['.', ['[]', [1]], 0]], 'export default -[1][0];')
        // and outside it only through a name
        writes(['.', ['-', ['[]', []]], 0], 'const $0=-[];export default $0[0];')
        writes(['.', ['-', ['[]', []]], 'a'], 'const $0=-[];export default $0.a;')
        // a negated function likewise
        writes(['-', ['=>', null, 1]], 'const $0=(...$a)=>1;export default -$0;')
        refuses(['-', 1, 2], 'a binary - node')
        // A call has no spelling yet, and these are the two shapes that
        // cannot take the obvious one when it lands: `-1()` is `-(1())`, so
        // a negative callee has to say that the negation happens first. A
        // group would say it, `(-1)()`, and until the grammar has one a
        // `const` does — the answer an access base already takes, for a
        // negative leaf and a `['-', …]` node alike. These two lines redden
        // the moment a `()` is given a spelling, which is where that has to
        // be decided.
        refuses(['()', -1, ['[]', []]], 'a () node')
        refuses(['()', ['-', 1], ['[]', []]], 'a () node')
    },
    /**
     * A negative number is a leaf — a JSON input gives one — and the
     * language's only spelling for it is the prefix, which the lowering
     * folds back into the leaf. So the text reads back as the graph it was
     * written from.
     */
    negativeLeaves: () => {
        writes(['[]', [-0, -1.5, -1n]], 'export default [-0,-1.5,-1n];')
    },

    /**
     * What {@link writes} means by "reads back as the same graph": the same
     * graph *as the lowering makes of it*. Reading a text is parsing and
     * lowering, and the lowering folds — a negated numeric literal is the
     * number — so a text read back is always in the form the lowering
     * produces.
     *
     * For every graph the compiler emits that is the graph itself, since
     * the compiler's graphs come out of that same lowering. A graph built
     * by hand need not be: `['-', 1]` is a fine EDAG, worth `-1`, and its
     * text reads back as the leaf `-1` — the same value, and the form the
     * fold gives it.
     *
     * Refusing it was considered and is wrong. The writer has a faithful
     * text for the *value*, and the node count differs only because the
     * reading normalizes. Tying a refusal to what the folder happens to do
     * would also grow one per fold: `['+', 1, 2]` would want the same
     * treatment the moment that fold lands, and so would every constant
     * expression after it.
     */
    readsBackNormalized: () => {
        assertEq(unwrap(tryStringify(['-', 1])), 'export default -1;')
        const { edag } = unresolved(unwrap(parse(path)('export default -1;')))
        assertStructurallySame(edag, -1)
        // and one deeper, where the fold runs twice
        assertEq(unwrap(tryStringify(['-', ['-', 1]])), 'export default - -1;')
        assertStructurallySame(unresolved(unwrap(parse(path)('export default - -1;'))).edag, 1)
    },
    // A node that mints identity is one value however many edges reach it,
    // and a `const` is the only thing in text that keeps that, so a shared
    // one is hoisted and written once. An unshared one is written where it
    // stands, every occurrence its own value.
    identity: () => {
        /** @type {Exp} */
        const o = ['{}', []]
        writes(['[]', [o, o]], 'const $0={};export default [$0,$0];')
        writes(['[]', [['{}', []], ['{}', []]]], 'export default [{},{}];')
        writes(['[]', [identity, identity]], 'const $0=(...$a)=>$a;export default [$0,$0];')
    },
    // An access is not hoisted, though the analysis merged its occurrences:
    // the merge happens again when the output is read, and a `const` would
    // evaluate it where the source did not.
    merged: () => {
        /** @type {Exp} */
        const o = ['{}', [[':', 'a', 1]]]
        writes(['[]', [['.', o, 'a'], ['.', o, 'a']]], 'const $0={"a":1};export default [$0.a,$0.a];')
    },
    // A base the grammar takes no access on — a number, a bigint, a function
    // — gets a `const` of its own, since `1.x` is no spelling of `['.', 1,
    // 'x']`. A container base is written in place, where `{}.a` is a
    // spelling the parser reads back.
    bases: () => {
        writes(['.', 1, 'x'], 'const $0=1;export default $0.x;')
        writes(['.', 1n, 'x'], 'const $0=1n;export default $0.x;')
        writes(['.', identity, 'length'], 'const $0=(...$a)=>$a;export default $0.length;')
        writes(['.', ['{}', [[':', 'a', 1]]], 'a'], 'export default {"a":1}.a;')
        writes(['.', ['[]', [1, 2]], 0], 'export default [1,2][0];')
        // One `const` per base, and one only: two accesses on one base share
        // it, two bases do not, and a base named by an earlier statement is
        // not named again.
        writes(['[]', [['.', 1, 'x'], ['.', 1, 'y']]], 'const $0=1;export default [$0.x,$0.y];')
        writes(['[]', [['.', 1, 'x'], ['.', 2, 'y']]], 'const $0=1;const $1=2;export default [$0.x,$1.y];')
        writes([',', [['.', 1, 'x'], ['.', 1, 'y']]], 'const $0=1;const $1=$0.x;export default $0.y;')
    },
    // A key is a name after `.` where the word admits one, and a key in
    // brackets otherwise: the empty word, a word a digit opens, a word
    // holding what an identifier may not, and every number.
    keys: () => {
        writes(['=>', null, ['.', ['args'], 'length']], 'export default (...$a)=>$a.length;')
        writes(['=>', null, ['.', ['args'], 'A_$9']], 'export default (...$a)=>$a.A_$9;')
        writes(['=>', null, ['.', ['args'], '']], 'export default (...$a)=>$a[""];')
        writes(['=>', null, ['.', ['args'], '0a']], 'export default (...$a)=>$a["0a"];')
        writes(['=>', null, ['.', ['args'], 'a-b']], 'export default (...$a)=>$a["a-b"];')
        // a word that denotes a value names a property like any other
        writes(['=>', null, ['.', ['args'], 'NaN']], 'export default (...$a)=>$a.NaN;')
        writes(['=>', null, ['.', ['args'], '_x']], 'export default (...$a)=>$a._x;')
        writes(['=>', null, ['.', ['args'], '$x']], 'export default (...$a)=>$a.$x;')
        // The Kelvin sign lowercases to `k` and is no letter the tokenizer
        // takes, so a key holding one is a key in brackets. The characters
        // are classified by code point for that reason, never by case fold.
        writes(['=>', null, ['.', ['args'], '\u212a']], 'export default (...$a)=>$a["\u212a"];')
        writes(['=>', null, ['.', ['args'], 0]], 'export default (...$a)=>$a[0];')
        writes(['=>', null, ['.', ['args'], 1.5]], 'export default (...$a)=>$a[1.5];')
    },
    // Every keyword is a name after `.`, the six words that denote a value
    // included: a property is named by an `IdentifierName` in JavaScript,
    // and the grammar follows. So the writer has no rule about them — this
    // is the case that would fail if one were needed again, over every
    // keyword rather than over a list someone remembered to update.
    keywords: () => {
        keywords.forEach(k => {
            const written = tryStringify(['=>', null, ['.', ['args'], k]])
            // `arguments` and `with` are on the prototypes, and an access on
            // either has no text at all.
            if (written[0] === 'error') {
                assertEq(written[1], 'a prohibited property name', k)
                return
            }
            assertEq(reads(['=>', null, ['.', ['args'], k]]), `export default (...$a)=>$a.${k};`)
        })
    },
    // A function is written with its parameter and no other, since a body
    // reads its arguments as one node: the parameters are named as a
    // spreadsheet names its columns, by depth, so a body names its own and
    // reaches the ones outside it.
    functions: () => {
        writes(identity, 'export default (...$a)=>$a;')
        writes(['=>', null, ['=>', null, ['args']]], 'export default (...$a)=>(...$b)=>$b;')
        writes(['=>', null, ['[]', [['=>', null, 1]]]], 'export default (...$a)=>[(...$b)=>1];')
        // `$z` then `$aa`: the letters carry past the twenty-sixth body.
        assert(reads(nested(27)).endsWith('(...$y)=>(...$z)=>(...$aa)=>$aa;'))
    },
    // A body whose text opens with `{` is written as a block: `=> {` opens a
    // block and not an object, so the value has to be returned from it. The
    // question is the text's and not the node's — an access on an object
    // literal opens with one too, and reads back as a block just the same.
    block: () => {
        writes(['=>', null, ['{}', [[':', 'x', 1]]]], 'export default (...$a)=>{return {"x":1};};')
        writes(['=>', null, ['.', ['{}', [[':', 'a', 1]]], 'a']], 'export default (...$a)=>{return {"a":1}.a;};')
        writes(['=>', null, ['[]', [1]]], 'export default (...$a)=>[1];')
        writes(['=>', null, ['.', 'x', 'length']], 'export default (...$a)=>"x".length;')
    },
    // A body's own `const`s: a shared constructor, hoisted so that it is one
    // value per call; a numeric or function access base, which the grammar
    // takes no access on; and the anchors of a comma the body holds. Each is
    // named by the body's parameter and its slot, `$a0` where the parameter
    // is `$a`, so a scope's names collide with no other's and a body reads
    // only its own.
    //
    // A body needing none keeps the expression form, which `functions`
    // above pins: the `const`s are what make it a block.
    bodyConsts: () => {
        /** @type {Exp} */
        const o = ['{}', []]
        writes(['=>', null, ['[]', [o, o]]], 'export default (...$a)=>{const $a0={};return [$a0,$a0];};')
        writes(['=>', null, ['.', 1, 'x']], 'export default (...$a)=>{const $a0=1;return $a0.x;};')
        writes(['=>', null, ['.', identity, 'length']], 'export default (...$a)=>{const $a0=(...$b)=>$b;return $a0.length;};')
        writes(['=>', null, [',', [['[]', []], 1]]], 'export default (...$a)=>{const $a0=[];return 1;};')
        // the arguments are a body's to name, which no module `const` can
        writes(['=>', null, ['[]', [['[]', [['args']]], ['[]', [['args']]]]]], 'export default (...$a)=>[[$a],[$a]];')
        // one scope per body: the module's `$0`, the outer body's `$a0` and
        // the inner one's `$b0` stand together, each numbering from zero
        writes(
            (() => {
                /** @type {Exp} */
                const m = ['[]', []]
                /** @type {Exp} */
                const inner = ['{}', []]
                return [',', [['[]', [m, m]], ['=>', null, ['[]', [['=>', null, ['[]', [inner, inner]]]]]]]]
            })(),
            'const $0=[];const $1=[$0,$0];export default (...$a)=>[(...$b)=>{const $b0={};return [$b0,$b0];}];')
    },
    // A comma at the root is the module it came from: an unused `const` per
    // anchor and then the export, each anchor taking a name it does not
    // spend so that one graph is one text. Any other root is the export
    // alone.
    roots: () => {
        writes([',', [['[]', []], 1]], 'const $0=[];export default 1;')
        writes([',', [1, 2]], 'const $0=1;export default 2;')
        /** @type {Exp} */
        const o = ['{}', []]
        writes([',', [['[]', []], ['[]', [o, o]]]], 'const $0=[];const $1={};export default [$1,$1];')
        writes([',', [['[]', [o, o]], ['[]', [o]]]], 'const $0={};const $1=[$0,$0];export default [$0];')
    },
    // The chunks, which is what the writer writes and the string is joined
    // from.
    chunks: () => {
        assertStructurallySame(toArray(unwrap(trySerialize(1))), ['export default ', '1', ';'])
    },
    // Every refusal, by the message it carries: a node kind with no spelling
    // yet, a position a spelling has none in, and a key no literal reads
    // back. Each names the feature that replaces it.
    refuses: () => {
        // A node kind this writer has no spelling for, which is how the
        // feature that adds one is made to add its spelling here too.
        refuses(['+', 1], 'a + node')
        refuses(['[]', [['...', ['[]', []]]]], 'a spread')
        refuses(['{}', [['...', ['[]', []]]]], 'a spread')
        refuses(['.', ['args'], 'b', ['|()', ['args']]], 'a chain step')
        refuses(['=>', ['frame'], 1], 'a function with a frame')
        // A node kind with a spelling, in a position that has none.
        refuses(['args'], 'the arguments outside a function')
        // a comma is a scope's own form — a module's root and a function's
        // body are where one is read — so one inside a container has no
        // source spelling until the operator lands
        refuses(['[]', [[',', [1, 2]]]], 'a comma outside a scope')
        refuses(['=>', null, ['[]', [[',', [1, 2]]]]], 'a comma outside a scope')
        // A key no literal spells: a computed one, an object key that is not
        // a string, and the three numbers the tokenizer does not read back.
        refuses(['=>', null, ['.', ['args'], ['Number', ['args']]]], 'an access key that is no literal')
        refuses(['{}', [[':', 1, 2]]], 'an object key that is not a string')
        refuses(['=>', null, ['.', ['args'], NaN]], 'a number key no literal reads back')
        refuses(['=>', null, ['.', ['args'], Infinity]], 'a number key no literal reads back')
        refuses(['=>', null, ['.', ['args'], -0]], 'a number key no literal reads back')
        // A key naming a property of a built-in prototype: the grammar
        // refuses it in either spelling, `.k` and `["k"]` alike, so an
        // access on one has no text at all — `length`, which both languages
        // read as an own property, is the one such name that has.
        refuses(['=>', null, ['.', ['args'], 'constructor']], 'a prohibited property name')
        refuses(['=>', null, ['.', ['args'], '__proto__']], 'a prohibited property name')
        refuses(['=>', null, ['.', ['args'], 'toString']], 'a prohibited property name')
        // The first refusal is the one reported, and nothing after it is
        // written: among the values a statement hoists, and among the
        // statements of a module.
        refuses(
            (() => {
                /** @type {Exp} */
                const bad = ['[]', [['...', 1]]]
                /** @type {Exp} */
                const good = ['{}', []]
                return ['[]', [bad, bad, good, good]]
            })(),
            'a spread')
        refuses([',', [['+', 1], 1]], 'a + node')
        // A comma with no anchor to write: with one operand it would read
        // back as that operand alone, and with none it is no scope. Linking
        // emits neither, at a root or in a body — a comma is built only
        // where an anchor or an unbound import is there to carry.
        refuses([',', [1]], 'a comma with fewer than two operands')
        refuses([',', []], 'a comma with fewer than two operands')
        refuses(['=>', null, [',', [1]]], 'a comma with fewer than two operands')
        refuses(['=>', null, [',', []]], 'a comma with fewer than two operands')
        // An anchor whose operand already has a name: its statement would be
        // the alias `const $1=$0;`, which the front end reads back as
        // nothing — an alias to a reached `const` is not an anchored
        // computation — and the comma would go with it. Linking emits no
        // such graph: `const a = []; const b = a; export default a;` drops
        // the alias and is the array alone.
        refuses(
            (() => {
                /** @type {Exp} */
                const o = ['[]', []]
                return [',', [o, o]]
            })(),
            'an anchor that repeats a hoisted value')
    },
    // The writer's one law, over graphs nobody chose: a graph is refused,
    // or its text is read back to the same table. Every case above is a
    // text this module pins; this is the claim that nothing outside them
    // is answered with a plausible wrong value
    // ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)),
    // which is what a writer whose contract is the round trip may not do,
    // and which four hand-picked accept sets in a row did not catch.
    //
    // The graphs are every shape over every shape over the atoms: 2169 of
    // them, of which 1157 have a text and the rest are refused by name.
    // Before a body could hold a `const` the writer spelled 1110 — the 47
    // this law newly round-trips rather than skipping are what a body's
    // `const`s are worth to it.
    law: () => {
        generated.forEach(e => {
            const written = tryStringify(e)
            if (written[0] === 'error') { return }
            reads(e)
        })
    },
}
