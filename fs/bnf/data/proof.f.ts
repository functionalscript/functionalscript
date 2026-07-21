import { stringify } from '../../media/json/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { oneEncode, option, range, rangeDecode, repeat0Plus, set } from '../module.f.ts'
import { classic, deterministic } from '../testlib.f.ts'
import { emptyTagMap, type RuleSet, toData } from './module.f.ts'
import { assertEq } from '../../asserts/module.f.ts'

export const proof = {
    rangeDecode: () => {
        const decoded1 = stringify(sort)(rangeDecode(0x000079_000087))
        assertEq(decoded1, '[121,135]')

        const decoded2 = stringify(sort)(rangeDecode(0x000080_000087))
        assertEq(decoded2, '[128,135]')

        const decoded3 = stringify(sort)(rangeDecode(0x10FFFF_10FFFF))
        assertEq(decoded3, '[1114111,1114111]')
    },
    rangeEncode: () => {
        const encoded1 = oneEncode(0x79)
        if (encoded1 !== 0x000079_000079) {throw encoded1}

        const encoded2 = oneEncode(0x80)
        if (encoded2 !== 0x000080_000080) {throw encoded2}

        const encoded3 = oneEncode(0x10FFFF)
        if (encoded3 !== 0x10FFFF_10FFFF) {throw encoded3}
    },
    toData: [
        () => {
            const c = toData(classic())
            const d = toData(deterministic())
        },
        () => {
            const stringRule = 'true'
            const result = stringify(sort)(toData(stringRule))
            if (result !== '[{"":["0","1","2","3"],"0":1946157172,"1":1912602738,"2":1962934389,"3":1694498917},""]') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const result = stringify(sort)(toData(terminalRangeRule))
            if (result !== '[{"":1090519110},""]') { throw result } //1090519110 = 65 * 2^24 + 70
        },
        () => {
            const sequenceRangeRule = [range('AF'), range('af')]
            const result = stringify(sort)(toData(sequenceRangeRule))
            if (result !== '[{"":["0","1"],"0":1090519110,"1":1627390054},""]') { throw result }
        },
        () => {
            const lazyRule = () => 'true'
            const result = stringify(sort)(toData(lazyRule))
            if (result !== '[{"":1946157172,"0":1912602738,"1":1962934389,"2":1694498917,"lazyRule":["","0","1","2"]},"lazyRule"]') { throw result }
        },
        () => {
            const varintRule = { true: 'true', false: 'false'}
            const result = stringify(sort)(toData(varintRule))
            const expected = '[{"":{"false":"5","true":"0"},"0":["1","2","3","4"],"1":1946157172,"2":1912602738,"3":1962934389,"4":1694498917,"5":["6","7","8","9","4"],"6":1711276134,"7":1627390049,"8":1811939436,"9":1929379955},""]'
            assertEq(result, expected, [result, expected])
        },
        () => {
            const lazyRule = () => 'true'
            const lazyRule0 = () => 'false'
            const result = stringify(sort)(toData([lazyRule, lazyRule0]))
            const expected = '[{"":["lazyRule","lazyRule0"],"0":1946157172,"1":1912602738,"2":1962934389,"3":1694498917,"4":1711276134,"5":1627390049,"6":1811939436,"7":1929379955,"lazyRule":["0","1","2","3"],"lazyRule0":["4","5","6","7","3"]},""]'
            assertEq(result, expected, [result, expected])
        },
        () => {
            const emptyRule = ''
            const result = stringify(sort)(toData(emptyRule))
            const expected = '[{"":[]},""]'
            assertEq(result, expected, [result, expected])
        },
        () => {
            const optionRule = option('a')
            const result = stringify(identity)(toData(optionRule))
            if (result !== '[{"0":["1"],"1":1627390049,"2":[],"":{"some":"0","none":"2"}},""]') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(option('a'))
            const result = stringify(identity)(toData(repeatRule))
            if (result !== '[{"0":{"some":"1","none":"3"},"1":["2"],"2":1627390049,"3":[],"":["0","r"],"r":{"some":"","none":"3"}},"r"]') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(set(' \n\r\t'))
            const result = stringify(identity)(toData(repeatRule))
            if (result !== '[{"0":{" ":"1","\\n":"2","\\r":"3","\\t":"4"},"1":536870944,"2":167772170,"3":218103821,"4":150994953,"5":[],"":["0","r"],"r":{"some":"","none":"5"}},"r"]') { throw result }
        }
    ],
    variantTest: () => {
        const varintRule = { a: 'a', b: 'b'}
        const result = stringify(sort)(toData(varintRule))
        if (result !== '[{"":{"a":"0","b":"2"},"0":["1"],"1":1627390049,"2":["3"],"3":1644167266},""]') { throw result }
    },
    emptyTagMap: [
        () => {
            const stringRule = 'true'
            const result = JSON.stringify(emptyTagMap(toData(stringRule)[0]))
            assertEq(result, '{}')
        },
        () => {
            const emptyRule = ''
            const result = JSON.stringify(emptyTagMap(toData(emptyRule)[0]))
            assertEq(result, '{"":true}')
        },
        () => {
            const emptyRule = ''
            const varintRule = { true: 'true', e: emptyRule }
            const result = JSON.stringify(emptyTagMap(toData(varintRule)[0]))
            assertEq(result, '{"5":true,"":"e"}')
        },
        () => {
            const repeatRule = repeat0Plus(option('a'))
            const result = JSON.stringify(emptyTagMap(toData(repeatRule)[0]))
            assertEq(result, '{"0":"none","3":true,"":true,"r":"none"}')
        },
        () => {
            // Regression for the sequence case: a sequence is nullable iff
            // *all* of its items are, not just the first one. The old
            // descent-only implementation pinned the result to nullable as
            // soon as it saw the leading empty item, and reported this
            // 2-item sequence as nullable even though its second item is a
            // mandatory terminal.
            const data = toData(['', range('AA')])
            const emptyTags = emptyTagMap(data[0])
            assertEq(emptyTags[data[1]], undefined, emptyTags)
        },
        () => {
            // Regression: a fixed round count (one round per rule) settles
            // the nullable/non-nullable *set* — a standard result — but a
            // variant's chosen *tag* can still change for rounds after that,
            // while a cyclic dependency's own tag catches up. Here A is
            // nullable via 'x' (A -> E, both settle in 2 rounds), but B (a
            // 1-item sequence over A) only becomes nullable once A does, and
            // once B is nullable, A's true winning branch is 'y' (A -> B) —
            // reachable only by iterating to an actual fixpoint.
            const rs: RuleSet = { A: { x: 'E', y: 'B' }, B: ['A'], E: [] }
            assertEq(emptyTagMap(rs).A, 'y')
        },
    ],
    example: () => {
        const grammar = {
            space: 0x000020_000020,
            digit: 0x000030_000039,
            sequence: ['space', 'digit'],
            spaceOrDigit: {
                'whiteSpace': 'space',
                'digit': 'digit',
            }
        }
    },
}
