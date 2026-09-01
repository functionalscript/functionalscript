/**
 * @import { CodePoint } from '../../text/utf16/types.ts'
 * @import { RuleSet } from '../data/types.ts'
 * @import { Ast, Meta } from '../matcher/types.ts'
 * @import { Monoid } from '../../common/monoid/types.ts'
 * @import { SequenceTransformer } from '../matcher/types.ts'
 * @import { Rule as FRule } from '../types.ts'
 * @import { Match } from './types.ts'
 * @import { MatchResult } from './types.ts'
 */

import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { map, toArray } from '../../types/list/module.f.mjs'
import { commaJoin0Plus, eof, option, range, repeat0Plus, set } from '../module.f.mjs'
import { toData } from '../data/module.f.mjs'
import { descentParser } from '../descent/module.f.mjs'
import { dispatchMap, parser, parserRuleSet, transformers } from './module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { deterministic, showAst } from '../testlib.f.mjs'
import { repeat } from '../../types/array/module.f.mjs'

/** @type {(cp: CodePoint) => Meta<unknown, CodePoint>} */
const mapCodePoint = cp => [cp, undefined]

/** @type {(cp: CodePoint) => Meta<string, CodePoint>} */
const mapCodePointEmpty = cp => [cp, '']

/** @type {(cp: readonly CodePoint[]) => readonly Meta<unknown, CodePoint>[]} */
const withMeta = cp => toArray(map(mapCodePoint)(cp))

/** @type {Monoid<string>} */
const stringMonoid = {
    identity: '',
    operation: a => b => a + b,
}

/** @type {(mr: MatchResult<unknown>) => boolean} */
const isMatchSuccess = ([, success, remainder]) => success && remainder?.length === 0

/** @type {(ast: Ast<Meta<unknown, CodePoint>>) => Ast<CodePoint>} */
const astWithoutMeta = ast => ({
    ...ast,
    sequence: ast.sequence.map(item => item instanceof Array ? item[0] : astWithoutMeta(item)),
})

/** @type {(mr: MatchResult<unknown>) => string} */
const matchJson = ([ast, success, remainder]) => JSON.stringify([
    astWithoutMeta(ast),
    success,
    remainder?.map(([cp]) => cp) ?? remainder,
])

/** @type {(m: Match<unknown>) => (s: string, success: boolean) => void} */
const expectMatch = m => (s, success) => {
    const mr = m('', withMeta(toArray(stringToCodePointList(s))))
    assertEq(isMatchSuccess(mr), success, mr)
}

/**
 * One grammar matched by both backends, which must build the same AST for it:
 * the shape is pinned once and asserted against each backend, so neither can
 * drift from the shared contract without this failing.
 *
 * @type {(rule: FRule, s: string, expected: string) => () => void}
 */
const bothBackends = (rule, s, expected) => () => {
    const [, entry] = toData(rule)
    const cp = toArray(stringToCodePointList(s))
    const input = withMeta(cp)
    const dm = descentParser(rule)(entry, input)
    assertEq(showAst(dm.ast), expected, s)
    assertEq(showAst(parser(rule)(entry, input)[0]), expected, s)
}

export const proof = {
    dispatch: [
        () => {
            const terminalRangeRule = range('AF')
            const dm = dispatchMap(toData(terminalRangeRule)[0])
            assertEq(
                JSON.stringify(dm),
                '{"":{"rangeMap":[[null,64],[{"name":""},70]]}}')
        },
        () => {
            // The sequence's own entry holds its first set only — the first
            // item's, because that item cannot match empty. Nothing is
            // consumed by dispatch, so no chain of follow-up rules is stored.
            const stringRule = 'AB'
            const dm = dispatchMap(toData(stringRule)[0])
            assertEq(
                JSON.stringify(dm),
                '{"0":{"rangeMap":[[null,64],[{"name":"0"},65]]},"1":{"rangeMap":[[null,65],[{"name":"1"},66]]},"":{"rangeMap":[[null,64],[{"name":"0"},65]]}}')
        },
        () => {
            const a = range('AA')
            const b = range('BB')
            const ab = [a, b]
            const dm = dispatchMap(toData(ab)[0])
            assertEq(
                JSON.stringify(dm),
                '{"0":{"rangeMap":[[null,64],[{"name":"0"},65]]},"1":{"rangeMap":[[null,65],[{"name":"1"},66]]},"":{"rangeMap":[[null,64],[{"name":"0"},65]]}}')
        },
        () => {
            const emptyRule = ''
            const dm = dispatchMap(toData(emptyRule)[0])
            assertEq(JSON.stringify(dm), '{"":{"rangeMap":[]}}')
        },
        () => {
            // A variant's entry is the one whose values are read: the branch
            // each lookahead selects, entered before the symbol is consumed.
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const dm = dispatchMap(toData(variantRule)[0])
            assertEq(
                JSON.stringify(dm),
                '{"0":{"rangeMap":[[null,64],[{"name":"0"},65]]},"1":{"rangeMap":[[null,65],[{"name":"1"},66]]},"":{"rangeMap":[[null,64],[{"tag":"a","name":"0"},65],[{"tag":"b","name":"1"},66]]}}')
        },
        () => {
            // `empty` is the nullable branch a dispatch miss selects.
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const dm = dispatchMap(toData(variantRule)[0])
            assertEq(
                JSON.stringify(dm),
                '{"0":{"rangeMap":[]},"1":{"rangeMap":[[null,64],[{"name":"1"},65]]},"":{"empty":{"tag":"e","name":"0"},"rangeMap":[[null,64],[{"tag":"a","name":"1"},65]]}}')
        },
        () => {
            const emptyRule = ''
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const dm = dispatchMap(toData(numberRule)[0])
            assertEq(
                JSON.stringify(dm),
                '{"0":{"empty":{"tag":"none","name":"1"},"rangeMap":[[null,44],[{"tag":"minus","name":"2"},45]]},"1":{"rangeMap":[]},"2":{"rangeMap":[[null,44],[{"name":"2"},45]]},"3":{"rangeMap":[[null,47],[{"name":"3"},57]]},"":{"rangeMap":[[null,44],[{"tag":"minus","name":"2"},45],[null,47],[{"name":"3"},57]]}}')
        },
        () => {
            // A nullable prefix merges each item's first set into the
            // sequence's, up to and including the first non-nullable item.
            const emptyRule = ''
            const spaceRule = range('  ')
            const optionalSpaceRule = { 'none': emptyRule, 'space': spaceRule}
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalSpaceRule, optionalMinusRule, digitRule]
            const dm = dispatchMap(toData(numberRule)[0])
            assertEq(
                JSON.stringify(dm),
                '{"0":{"empty":{"tag":"none","name":"1"},"rangeMap":[[null,31],[{"tag":"space","name":"2"},32]]},"1":{"rangeMap":[]},"2":{"rangeMap":[[null,31],[{"name":"2"},32]]},"3":{"empty":{"tag":"none","name":"1"},"rangeMap":[[null,44],[{"tag":"minus","name":"4"},45]]},"4":{"rangeMap":[[null,44],[{"name":"4"},45]]},"5":{"rangeMap":[[null,47],[{"name":"5"},57]]},"":{"rangeMap":[[null,31],[{"tag":"space","name":"2"},32],[null,44],[{"tag":"minus","name":"4"},45],[null,47],[{"name":"5"},57]]}}')
        },
        () => {
            // A sequence of nullable items only: the first-set loop runs off
            // the end instead of stopping at a non-nullable item.
            /** @type {RuleSet} */
            const ruleSet = {
                s: ['o1', 'o2'],
                o1: { some: 'm', none: 'e' },
                o2: { some: 'a', none: 'e' },
                m: range('--'),
                a: range('AA'),
                e: [],
            }
            assertEq(
                JSON.stringify(dispatchMap(ruleSet)),
                '{"m":{"rangeMap":[[null,44],[{"name":"m"},45]]},"e":{"rangeMap":[]},"o1":{"empty":{"tag":"none","name":"e"},"rangeMap":[[null,44],[{"tag":"some","name":"m"},45]]},"a":{"rangeMap":[[null,64],[{"name":"a"},65]]},"o2":{"empty":{"tag":"none","name":"e"},"rangeMap":[[null,64],[{"tag":"some","name":"a"},65]]},"s":{"rangeMap":[[null,44],[{"tag":"some","name":"m"},45],[null,64],[{"tag":"some","name":"a"},65]]}}')
            assertEq(
                matchJson(parserRuleSet(ruleSet)('s', withMeta([45, 65]))),
                '[{"sequence":[{"tag":"some","sequence":[45]},{"tag":"some","sequence":[65]}]},true,[]]')
        }
    ],
    parser: [
        () => {
            const emptyRule = ''
            const m = parser(emptyRule)
            assertEq(matchJson(m("", [])), '[{"sequence":[]},true,[]]')
        },
        () => {
            const emptyRule = ''
            const m = parser(emptyRule)
            assertEq(matchJson(m("", withMeta([65, 70]))), '[{"sequence":[]},true,[65,70]]')
        },
        () => {
            const terminalRangeRule = range('AF')
            const m = parser(terminalRangeRule)
            assertEq(matchJson(m("", withMeta([65]))), '[{"sequence":[65]},true,[]]')
        },
        () => {
            const terminalRangeRule = 0x000079_000087
            const m = parser(terminalRangeRule)
            assertEq(matchJson(m("", withMeta([64]))), '[{"sequence":[]},false,[64]]')
        },
        () => {
            const terminalRangeRule = 0x000080_000087 //broken range
            const m = parser(terminalRangeRule)
            assertEq(matchJson(m("", withMeta([64]))), '[{"sequence":[]},false,[64]]')
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = parser(variantRule)
            assertEq(matchJson(m("", withMeta([65]))), '[{"tag":"a","sequence":[65]},true,[]]')
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = parser(variantRule)
            assertEq(matchJson(m("", withMeta([64]))), '[{"sequence":[]},false,[64]]')
        },
        () => {
            // No branch dispatches on the end of input and none is nullable:
            // the match ran out of input, the `null` remainder.
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = parser(variantRule)
            assertEq(matchJson(m("", [])), '[{"sequence":[]},true,null]')
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const m = parser(variantRule)
            assertEq(matchJson(m("", [])), '[{"tag":"e","sequence":[]},true,[]]')
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const m = parser(variantRule)
            assertEq(matchJson(m("", withMeta([64]))), '[{"tag":"e","sequence":[]},true,[64]]')
        },
        () => {
            // Every item of a sequence owns a node — the leading one included.
            const stringRule = 'AB'
            const m = parser(stringRule)
            assertEq(
                matchJson(m("", withMeta([65,66]))),
                '[{"sequence":[{"sequence":[65]},{"sequence":[66]}]},true,[]]')
        },
        () => {
            // LL(1) never backtracks, so a failure keeps the position where
            // matching stopped: on the rejected `C`.
            const stringRule = 'AB'
            const m = parser(stringRule)
            assertEq(matchJson(m("", withMeta([65,67]))), '[{"sequence":[]},false,[67]]')
        },
        () => {
            // An option that matched empty still owns a node, so the AST says
            // the option was considered.
            const emptyRule = ''
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = parser(numberRule)
            assertEq(
                matchJson(m("", withMeta([50]))),
                '[{"sequence":[{"tag":"none","sequence":[]},{"sequence":[50]}]},true,[]]')
        },
        () => {
            // Taken, the option's tag lands on its own node, not the
            // enclosing sequence's.
            const emptyRule = ''
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = parser(numberRule)
            assertEq(
                matchJson(m("", withMeta([45,50]))),
                '[{"sequence":[{"tag":"minus","sequence":[45]},{"sequence":[50]}]},true,[]]')
        },
        () => {
            const emptyRule = ''
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = parser(numberRule)
            // The `null` remainder means the match ran out of input; the AST
            // keeps what had matched by then.
            assertEq(
                matchJson(m("", [])),
                '[{"sequence":[{"tag":"none","sequence":[]},{"sequence":[]}]},true,null]')
        },
        () => {
            const m = parser(option('a'))
            const expect = expectMatch(m)

            expect('a', true)
            expect('', true)
            expect('aa', false)
            expect('b', false)
        },
        () => {
            const ws = repeat0Plus(set(' \n\r\t'))

            const cj = commaJoin0Plus(ws)

            const value = () => ({
                object: cj('{}', 'a'),
                array: cj('[]', 'a')
            })

            value.name //bun will fail if no usage of name found

            const m = parser(value)

            /** @type {(s: string, success: boolean) => void} */
            const expect = (s, success) => {
                const mr = m('value', withMeta(toArray(stringToCodePointList(s))))
                assertEq(isMatchSuccess(mr), success, mr)
            }

            expect('', false)
            expect('[]', true)
            expect('[a]', true)
            expect('[a, a]', true)
            expect('{a}', true)
        },
        () => {
            const rule = deterministic()
            const [, entry] = toData(rule)
            const md = descentParser(rule)
            const ml = parser(rule)

            // The same inputs as `bnf/descent`'s copy of this group, which
            // pins the AST each one builds. Both backends produce the same
            // AST for the same grammar, so this side asserts equality with
            // `bnf/descent` instead of restating the expectations.
            /** @type {(s: string) => void} */
            const expectSameAst = s => {
                const cp = toArray(stringToCodePointList(s))
                const input = withMeta(cp)
                const dm = md(entry, input)
                const mr = ml(entry, input)
                assertEq(mr[1], true, s)
                assertEq(mr[2]?.length, 0, s)
                assertEq(showAst(mr[0]), showAst(dm.ast), s)
            }

            /** @type {(s: string) => void} */
            const expectNoMatch = s => {
                const mr = ml(entry, withMeta(toArray(stringToCodePointList(s))))
                assertEq(isMatchSuccess(mr), false, s)
            }

            expectSameAst('   true   ')
            expectSameAst('   "Hello"   ')
            expectSameAst('   "Hello\\n\\r\\""   ')
            expectSameAst('   -56.7e+5  ')
            expectSameAst('   [] ')
            expectSameAst('   {} ')
            expectSameAst('   [[[]]] ')
            expectSameAst('   [1] ')
            expectSameAst('   [ 12, false, "a"]  ')
            expectSameAst('   { "q": [ 12, false, [{"b" : "c"}], "a"] }  ')
            expectSameAst('   { "q": [ 12, false, [{}], "a"] }  ')
            expectSameAst('   [{ "q": [ 12, false, [{}], "a"] }]  ')

            expectNoMatch('   tr2ue   ')
            expectNoMatch('   true"   ')
            expectNoMatch('   "Hello   ')
            expectNoMatch('   h-56.7e+5   ')
            expectNoMatch('   -56.7e+5   3')
            expectNoMatch('   [ 12, false2, "a"]  ')
            expectNoMatch('   { "q": [ 12, false, [}], "a"] }  ')

            // The invalid input in detail. This backend never backtracks, so
            // the remainder is where matching stopped: on the `}` that closes
            // nothing, the same position the descent backend reports as its
            // furthest failure.
            const bad = '   [{ "q": [ 12, false, [}], "a"] }]  '
            const badMr = ml(entry, withMeta(toArray(stringToCodePointList(bad))))
            assertEq(badMr[1], false, bad)
            const remainder = assertNotNullish(badMr[2])
            assertEq(bad.length - remainder.length, 25, bad)
            assertEq(bad[25], '}', bad)
        }
    ],
    transformers: {
        terminalSequence: () => {
            const a = range('AA')
            const b = range('BB')
            const rule = /** @type {const} */ ([a, b])
            const t = transformers(stringMonoid)
            const terminal = t.terminalOf(([cp, metadata]) => [String.fromCodePoint(cp), metadata])
            /** @type {SequenceTransformer<string, readonly[string, string], string>} */
            const join = ([[x, y], metadata]) => [x + y, metadata]
            const sequence = t.sequenceOf(2, join)
            const match = t.build(t.map(
                t.entry(a, terminal),
                t.entry(b, terminal),
            ))(t.entry(rule, sequence))
            assertEq(
                JSON.stringify(match([[65, 'a'], [66, 'b']])),
                '["ok",["AB","ab"],[]]')
        },
        terminalEof: () => {
            const t = transformers(stringMonoid)
            const terminal = t.terminalOf(([cp, metadata]) => [cp, metadata])
            const match = t.build(t.map())(t.entry(eof, terminal))
            assertEq(JSON.stringify(match([])), '["ok",[-1,""],[]]')
        },
        emptySequence: () => {
            const empty = /** @type {const} */ ([])
            const t = transformers(stringMonoid)
            const sequence = t.sequenceOf(0, ([items, metadata]) => [items.length, metadata])
            const match = t.build(t.map())(t.entry(empty, sequence))
            assertEq(JSON.stringify(match([])), '["ok",[0,""],[]]')
        },
        variant: () => {
            const a = range('AA')
            const b = range('BB')
            const rule = /** @type {const} */ ({ a, b })
            const t = transformers(stringMonoid)
            const terminal = t.terminalOf(([cp, metadata]) => [String.fromCodePoint(cp), metadata])
            const variant = t.variantOf(['a', 'b'], ([[tag, value], metadata]) => [tag + value, metadata])
            const match = t.build(t.map(
                t.entry(a, terminal),
                t.entry(b, terminal),
            ))(t.entry(rule, variant))
            assertEq(JSON.stringify(match([[65, 'm']])), '["ok",["aA","m"],[]]')
        },
        repeat: () => {
            const a = range('AA')
            const rule = repeat0Plus(a)
            const t = transformers(stringMonoid)
            const terminal = t.terminalOf(([cp, metadata]) => [String.fromCodePoint(cp), metadata])
            const repeated = t.repeatOf(a, {
                init: '',
                update: (state, [value, metadata]) => state + value + metadata,
                end: state => [state, 'end:' + state],
            })
            const match = t.build(t.map(t.entry(a, terminal)))(t.entry(rule, repeated))
            assertEq(JSON.stringify(match([])), '["ok",["","end:"],[]]')
            assertEq(
                JSON.stringify(match([[65, 'x'], [65, 'y']])),
                '["ok",["AxAy","end:AxAy"],[]]')
        },
        defaultChildren: () => {
            const a = range('AA')
            const choice = /** @type {const} */ ({ a })
            const rule = /** @type {const} */ ([choice])
            const t = transformers(stringMonoid)
            /** @type {SequenceTransformer<string, readonly[Ast<unknown>], string>} */
            const show = ([[node], metadata]) => [JSON.stringify(node), metadata]
            const sequence = t.sequenceOf(1, show)
            const match = t.build(t.map())(t.entry(rule, sequence))
            assertEq(
                JSON.stringify(match([[65, 'm']])),
                '["ok",["{\\"tag\\":\\"a\\",\\"sequence\\":[[65,\\"m\\"]]}","m"],[]]')
        },
        defaultRepeat: () => {
            const repeated = repeat0Plus(range('AA'))
            const rule = /** @type {const} */ ([repeated])
            const t = transformers(stringMonoid)
            const match = t.build(t.map())(t.entry(
                rule,
                t.sequenceOf(1, ([items, metadata]) => [items, metadata]),
            ))
            assertEq(
                JSON.stringify(match([[65, 'a'], [65, 'b']])),
                '["ok",[[{"sequence":[{"sequence":[[65,"a"]]},{"sequence":[[65,"b"]]}]}],"ab"],[]]')
        },
        unitKinds: () => {
            const a = range('AA')
            const empty = /** @type {const} */ ([])
            const choice = /** @type {const} */ ({ a })
            const repeated = repeat0Plus(a)

            const terminalTools = transformers(stringMonoid)
            assertEq(
                JSON.stringify(terminalTools.build(terminalTools.map())(
                    terminalTools.entry(a, terminalTools.unit))([[65, 'a']])),
                '["ok",[null,"a"],[]]')

            const emptyTools = transformers(stringMonoid)
            assertEq(
                JSON.stringify(emptyTools.build(emptyTools.map())(
                    emptyTools.entry(empty, emptyTools.unit))([])),
                '["ok",[null,""],[]]')

            const variantTools = transformers(stringMonoid)
            const variantMatch = variantTools.build(variantTools.map(
                variantTools.entry(a, variantTools.unit),
            ))(variantTools.entry(choice, variantTools.unit))
            assertEq(JSON.stringify(variantMatch([[65, 'a']])), '["ok",[null,"a"],[]]')
            assertEq(JSON.stringify(variantMatch([[66, 'b']])), '["no-match",[[66,"b"]]]')
            assertEq(JSON.stringify(variantMatch([])), '["no-match",null]')

            const repeatTools = transformers(stringMonoid)
            const repeatMatch = repeatTools.build(repeatTools.map())(
                repeatTools.entry(repeated, repeatTools.unit))
            assertEq(
                JSON.stringify(repeatMatch([[65, 'a'], [65, 'b']])),
                '["ok",[null,"ab"],[]]')
        },
        metadataGrouping: () => {
            const a = range('AA')
            const b = range('BB')
            const c = range('CC')
            const inner = /** @type {const} */ ([b, c])
            const nested = /** @type {const} */ ([a, inner])
            const flat = /** @type {const} */ ([a, b, c])
            const t0 = transformers(stringMonoid)
            const nestedMatch = t0.build(t0.map(
                t0.entry(inner, t0.sequenceOf(2, ([items, metadata]) => [items, metadata])),
            ))(t0.entry(nested, t0.sequenceOf(2, ([items, metadata]) => [items, metadata])))
            const t1 = transformers(stringMonoid)
            const flatMatch = t1.build(t1.map())(
                t1.entry(flat, t1.sequenceOf(3, ([items, metadata]) => [items, metadata])))
            const input = /** @type {const} */ ([[65, 'a'], [66, 'b'], [67, 'c']])
            const nestedResult = nestedMatch(input)
            const flatResult = flatMatch(input)
            assert(nestedResult[0] === 'ok')
            assert(flatResult[0] === 'ok')
            assertEq(nestedResult[1][1], flatResult[1][1])
            assertEq(flatResult[1][1], 'abc')
        },
        noMatch: () => {
            const rule = /** @type {const} */ ([range('AA'), range('BB')])
            const t = transformers(stringMonoid)
            const match = t.build(t.map())(
                t.entry(rule, t.sequenceOf(2, ([items, metadata]) => [items, metadata])))
            assertEq(JSON.stringify(match([[65, 'a']])), '["no-match",null]')
            assertEq(JSON.stringify(match([[65, 'a'], [67, 'c']])), '["no-match",[[67,"c"]]]')

            const pastEof = /** @type {const} */ ([eof, { a: range('AA') }])
            const pastEofMatch = t.build(t.map())(t.entry(
                pastEof,
                t.sequenceOf(2, ([items, metadata]) => [items, metadata]),
            ))
            assertEq(JSON.stringify(pastEofMatch([])), '["no-match",null]')
        },
        deep: () => {
            const t = transformers(stringMonoid)
            const match = t.build(t.map())(t.entry(deterministic(), t.unit))
            const n = 1000
            const cp = toArray(map(mapCodePointEmpty)(
                toArray(stringToCodePointList('['.repeat(n) + ']'.repeat(n)))))
            assertEq(JSON.stringify(match(cp)), '["ok",[null,""],[]]')
        },
        throw: {
            unreachable: () => {
                const t = transformers(stringMonoid)
                return t.build(t.map(t.entry(range('BB'), t.unit)))(t.entry(range('AA'), t.unit))
            },
            kind: () => {
                const t = transformers(stringMonoid)
                return t.build(t.map())(t.entry(range('AA'), t.sequenceOf(0, ([items, metadata]) => [items, metadata])))
            },
            sequenceArity: () => {
                const t = transformers(stringMonoid)
                const rule = /** @type {const} */ ([range('AA')])
                return t.build(t.map())(t.entry(rule, t.sequenceOf(0, ([items, metadata]) => [items, metadata])))
            },
            variantBranches: () => {
                const t = transformers(stringMonoid)
                const rule = /** @type {const} */ ({ a: range('AA') })
                return t.build(t.map())(t.entry(rule, t.variantOf(['b'], ([branch, metadata]) => [branch, metadata])))
            },
            duplicateVariantBranch: () => {
                const t = transformers(stringMonoid)
                const rule = /** @type {const} */ ({ a: range('AA'), b: range('BB') })
                return t.build(t.map())(t.entry(rule, t.variantOf(['a', 'a'], ([branch, metadata]) => [branch, metadata])))
            },
            repeatItem: () => {
                const a = range('AA')
                const t = transformers(stringMonoid)
                const repeated = t.repeatOf(range('BB'), {
                    init: '',
                    update: state => state,
                    end: state => [state, state],
                })
                return t.build(t.map())(t.entry(repeat0Plus(a), repeated))
            },
            duplicateStart: () => {
                const rule = range('AA')
                const t = transformers(stringMonoid)
                return t.build(t.map(t.entry(rule, t.unit)))(t.entry(rule, t.unit))
            },
            mappedBranch: () => {
                const a = range('AA')
                const choice = /** @type {const} */ ({ a })
                const rule = /** @type {const} */ ([choice])
                const t = transformers(stringMonoid)
                return t.build(t.map(t.entry(a, t.unit)))(t.entry(rule, t.unit))
            },
            unmappedBranch: () => {
                const a = range('AA')
                const rule = /** @type {const} */ ({ a })
                const t = transformers(stringMonoid)
                return t.build(t.map())(t.entry(rule, t.variantOf(['a'], ([branch, metadata]) => [branch, metadata])))
            },
            factory: () => {
                const a = transformers(stringMonoid)
                const b = transformers(stringMonoid)
                return a.build(a.map())(b.entry(range('AA'), b.unit))
            },
        },
    },
    longInput: [
        () => {
            // Long repetition across the whole input: matched iteratively, so
            // neither the JS call stack nor the frame stack grows with it.
            const rule = repeat0Plus(set(' \n\r\t'))
            const m = parser(rule)
            const [, success, remainder] = m(toData(rule)[1], withMeta(toArray(stringToCodePointList(' '.repeat(10000)))))
            assertEq(success, true)
            assertEq(remainder?.length, 0)
        },
        () => {
            // Deep non-repetition nesting: 5000 bracket levels in the
            // JSON-like test grammar. The frame stack grows on the heap, so
            // depth is bounded by memory rather than the JS call stack.
            const m = parser(deterministic())
            const n = 5000
            const cp = toArray(stringToCodePointList('['.repeat(n) + ']'.repeat(n)))
            const [, success, remainder] = m('', withMeta(cp))
            assertEq(success, true)
            assertEq(remainder?.length, 0)
        },
    ],
    logicalEof: [
        () => {
            // EOF dispatches below every ordinary symbol, so its cut point is
            // `-2` — the stored endpoint codes never reach the dispatch map.
            const dm = dispatchMap(toData(eof)[0])
            assertEq(JSON.stringify(dm), '{"":{"rangeMap":[[null,-2],[{"name":""},-1]]}}')
        },
        () => {
            // The matcher synthesizes one EOF after the physical input, so an
            // `eof` terminal matches empty input. It adds no AST leaf, and the
            // remainder stays physical: empty, not `null`.
            const m = parser(eof)
            assertEq(matchJson(m('', [])), '[{"sequence":[]},true,[]]')
        },
        () => {
            // Callers pass physical symbols only, so EOF is not available
            // before the end of the input.
            const m = parser(eof)
            assertEq(matchJson(m('', withMeta([65]))), '[{"sequence":[]},false,[65]]')
        },
        () => {
            // Non-empty input: the terminal consumes the synthesized EOF after
            // the last code point.
            const m = parser([range('AA'), eof])
            assertEq(matchJson(m('', withMeta([65]))), '[{"sequence":[{"sequence":[65]},{"sequence":[]}]},true,[]]')
        },
        () => {
            // Exactly one EOF is synthesized: the second `eof` terminal has
            // nothing to consume, so the match runs out of input — the `null`
            // remainder this backend reports for that.
            const m = parser([eof, eof])
            assertEq(matchJson(m('', [])), '[{"sequence":[{"sequence":[]},{"sequence":[]}]},true,null]')
        },
        () => {
            // A variant past the consumed EOF has no symbol to dispatch on:
            // the match runs out of input there too.
            const m = parser([eof, { a: range('AA') }])
            assertEq(matchJson(m('', [])), '[{"sequence":[{"sequence":[]},{"sequence":[]}]},true,null]')
        },
        () => {
            // EOF as one alternative among ordinary terminals.
            const m = parser({ a: range('AA'), e: eof })
            assertEq(matchJson(m('', [])), '[{"tag":"e","sequence":[]},true,[]]')
            assertEq(matchJson(m('', withMeta([65]))), '[{"tag":"a","sequence":[65]},true,[]]')
        },
        () => {
            // Repetition terminates on EOF: consuming it moves the cursor, so
            // the repeat makes exactly one round and then stops — its second
            // round has no symbol left to dispatch on.
            const rule = repeat0Plus(eof)
            const m = parser(rule)
            assertEq(matchJson(m(toData(rule)[1], [])), '[{"sequence":[{"sequence":[]}]},true,[]]')
        },
        () => {
            // Running out of input inside a repetition round ends the whole
            // match, keeping the rounds collected so far.
            const rule = repeat0Plus([eof, eof])
            const m = parser(rule)
            assertEq(
                matchJson(m(toData(rule)[1], [])),
                '[{"sequence":[{"sequence":[{"sequence":[]},{"sequence":[]}]}]},true,null]')
        },
    ],
    repeat: [
        () => {
            // A `repeat` rule's entry is its item's first set: the matcher
            // starts one more round exactly while the lookahead is in it, and
            // matches the repetition iteratively into one flat node.
            const rule = repeat0Plus(range('AF'))
            const [ruleSet, entry] = toData(rule)
            assertEq(JSON.stringify(ruleSet[entry]), '"0"')
            assertEq(
                JSON.stringify(dispatchMap(ruleSet)[entry]),
                '{"rangeMap":[[null,64],[{"name":"0"},70]]}')
        },
        () => {
            // A repetition of itself has no first set to dispatch on, and
            // asking for one would not terminate. `toData` never folds such a
            // rule; a hand-written rule set can still hold one, and it can
            // only match zero rounds.
            /** @type {RuleSet} */
            const ruleSet = { repeated: 'repeated' }
            assertEq(
                JSON.stringify(dispatchMap(ruleSet)),
                '{"repeated":{"rangeMap":[]}}')
            const m = parserRuleSet(ruleSet)
            assertEq(matchJson(m('repeated', [])), '[{"sequence":[]},true,[]]')
            assertEq(matchJson(m('repeated', withMeta([65]))), '[{"sequence":[]},true,[65]]')
        },
        () => {
            // The right-recursive spelling `toData` folds away can still be
            // hand-written; it then dispatches — and nests — as the grammar
            // says, one recursion level per item.
            /** @type {readonly [RuleSet, string]} */
            const repeatData = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            assertEq(
                JSON.stringify(dispatchMap(repeatData[0])),
                '{"ws":{"rangeMap":[]},"a":{"rangeMap":[[null,64],[{"name":"a"},65]]},"repa":{"rangeMap":[[null,64],[{"name":"a"},65]]},"":{"rangeMap":[[null,64],[{"name":"a"},65]]}}')
        },
    ],
    repeatParser: [
        () => {
            // The hand-written right-recursive chain: `""` requires `repa`,
            // which requires `a` and `""` again, so every input eventually
            // runs out — the `null` remainder — and the AST nests one level
            // per matched item because the *grammar* is right-recursive.
            /** @type {readonly [RuleSet, string]} */
            const repeatData = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            assertEq(
                matchJson(m("", [])),
                '[{"sequence":[{"sequence":[]},{"sequence":[{"sequence":[]}]}]},true,null]')
            const mr1 = m("", withMeta([65]))
            assertEq(showAst(mr1[0]), '(() (("A") (() (()))))')
            assertEq(mr1[1], true)
            assertEq(mr1[2], null)
            const mr3 = m("", withMeta([65,65,65]))
            assertEq(showAst(mr3[0]), '(() (("A") (() (("A") (() (("A") (() (()))))))))')
            assertEq(mr3[1], true)
            assertEq(mr3[2], null)
            assertEq(matchJson(m("", withMeta([66]))), '[{"sequence":[]},false,[66]]')
        },
    ],
    // The two backends consume the same `RuleSet` and must agree about the AST
    // it implies: `bnf/descent` builds a node per rule *invocation*, and so
    // does this backend — a rule is entered before its first symbol is
    // consumed, so the dispatch only selects and never absorbs a child's leaf,
    // children or tag into the enclosing node.
    //
    // Each case below is one grammar matched by both backends against one
    // pinned AST, so neither can drift from the shared contract unremarked.
    // These are the cases that used to diverge (see the git history of
    // `../ll1/README.md` for the old shapes); only `variant` always agreed.
    descentEquivalence: {
        // Every item of a sequence owns a node, the leading one included.
        leadingItem: bothBackends(
            [range('AA'), range('BB'), range('CC')], 'ABC',
            '(("A") ("B") ("C"))'),
        // A taken variant tags the branch's own node.
        variant: bothBackends(
            { a: range('AA'), b: range('BB') }, 'A',
            '"a"("A")'),
        // A nullable item that matched empty still owns a node, so the AST
        // says the option was considered.
        skippedOption: bothBackends(
            [option(range('--')), range('09')], '5',
            '("none"() ("5"))'),
        // Taken, the option's tag lands on its own node, not the enclosing one.
        takenOption: bothBackends(
            [option(range('--')), range('09')], '-5',
            '("some"("-") ("5"))'),
        // A repetition is one flat node of items in both backends.
        repetition: bothBackends(
            repeat0Plus(range('AA')), 'AAA',
            '(("A") ("A") ("A"))'),
        // Grouping survives: `[[A,B],C]` and `[A,B,C]` — the `leadingItem`
        // case above — are distinguishable ASTs.
        nesting: bothBackends(
            [[range('AA'), range('BB')], range('CC')], 'ABC',
            '((("A") ("B")) ("C"))'),
        // A repetition leading a sequence: its first set is inlined into the
        // sequence's dispatch entry at build time, yet it still matches as an
        // iterative rule invocation with a flat node of its own.
        repetitionInNullablePrefix: bothBackends(
            [repeat0Plus(range('AA')), range('09')], 'AA5',
            '((("A") ("A")) ("5"))'),
        // The same repetition matching empty leaves an empty node, not nothing.
        emptyRepetitionInNullablePrefix: bothBackends(
            [repeat0Plus(range('AA')), range('09')], '5',
            '(() ("5"))'),
    },
    throw: {
        ambiguousVariantDispatch: () => {
            // Two alternatives covering the same code point — dispatch merge throws.
            const conflictRule = { 'a': range('AA'), 'b': range('AA') }
            dispatchMap(toData(conflictRule)[0])
        },
        // Left recursion is not LL(1): no lookahead can decide it, and a match
        // would loop at the same position forever, so building throws instead.
        leftRecursiveSequence: () => {
            // `s` reaches itself through its nullable first item.
            /** @type {RuleSet} */
            const ruleSet = {
                s: ['o', 's'],
                o: { some: 'm', none: 'e' },
                m: range('--'),
                e: [],
            }
            dispatchMap(ruleSet)
        },
        leftRecursiveVariant: () => {
            /** @type {RuleSet} */
            const ruleSet = { v: { x: 'v', a: 'a' }, a: range('AA') }
            dispatchMap(ruleSet)
        },
    },
    // Regression: `emptyTagMap` must stay correct for cyclic rule references.
    // A naive single-pass, memoized derivation that marks a rule nullable as
    // a placeholder *before* recursing into its own children (to break the
    // cycle) over-approximates nullability here, and made `dispatchMap`
    // falsely report a first/first conflict for this grammar even though it
    // has none — `value` only ever nests inside brackets or is the literal
    // `a`, and `ws` is genuinely optional on both sides of it.
    cyclicNullability: () => {
        const ws = option(' ')
        const value = () => ({ array: ['[', value, ']'], leaf: 'a' })
        const m = parser([ws, value, ws]) // must not throw 'can not merge'
        const expect = expectMatch(m)

        expect('a', true)
        expect(' a ', true)
        expect('[a]', true)
        expect('[[a]]', true)
        expect(' [[a]] ', true)
        expect('b', false)
    },
    // A Social Security Number, `ddd-dd-dddd`.
    ssn: () => {
        const ws = repeat0Plus(' ')
        const d = range('09')
        const ssn = /** @type {const} */([
            ws, repeat(3)(d), ws, '-', ws, repeat(2)(d), ws, '-', ws, repeat(4)(d), ws])

        const m = parser(ssn) // must not throw 'can not merge'
        const expect = expectMatch(m)

        expect('123-45-6789', true)
        expect('  123  - 45 - 6789 ', true)
        expect('22', false) // too short
        expect('123456789', false) // no dashes
        expect('123-3456-78', false) // wrong grouping
        expect('123-345-6789', false) // wrong grouping
        expect('12a-34-5678', false) // a letter where a digit is required
    }
}
