import { cp, range, remove, str } from '../func/module.f.ts'
import { dispatchMap, parser, toRuleMap, type RuleMap } from './module.f.ts'
import { classic } from '../func/testlib.f.ts'
import * as j from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'

const stringify = j.stringify(sort)

const classicTest = () => {
    const map = {
        json: [
            ['element']
        ],
        value: [
            ['object'],
            ['array'],
            ['string'],
            ['number'],
            str('true'),
            str('false'),
            str('null'),
        ],
        object: [
            [cp('{'), 'ws', cp('}')],
            [cp('{'), 'members', cp('}')],
        ],
        members: [
            ['member'],
            ['member', cp(','), 'members'],
        ],
        member: [
            ['ws', 'string', 'ws', cp(':'), 'element'],
        ],
        array: [
            [cp('['), 'ws', cp(']')],
            [cp('['), 'elements', cp(']')],
        ],
        elements: [
            ['element'],
            ['element', cp(','), 'elements'],
        ],
        element: [
            ['ws', 'value', 'ws'],
        ],
        string: [
            [cp('"'), 'characters', cp('"')],
        ],
        characters: [
            [],
            ['character', 'characters'],
        ],
        character: [
            ...remove([0x20, 0x10FFFF], [cp('"'), cp('\\')]),
            [cp('\\'), 'escape'], // 92
        ],
        escape: [
            str('"'),
            str('\\'),
            str('/'),
            str('b'),
            str('f'),
            str('n'),
            str('r'),
            str('t'),
            [cp('u'), 'hex', 'hex', 'hex', 'hex'],
        ],
        hex: [
            ['digit'],
            [range('AF')], // A-F
            [range('af')], // a-f
        ],
        number: [
            ['integer', 'fraction', 'exponent'],
        ],
        integer: [
            ['digit'],
            ['onenine', 'digits'],
            [cp('-'), 'digit'],
            [cp('-'), 'onenine', 'digits'],
        ],
        digits: [
            ['digit'],
            ['digit', 'digits'],
        ],
        digit: [
            [cp('0')],
            ['onenine'],
        ],
        onenine: [
            [range('19')],
        ],
        fraction: [
            [],
            [cp('.'), 'digits'],
        ],
        exponent: [
            [],
            [cp('E'), 'sign', 'digits'],
            [cp('e'), 'sign', 'digits'],
        ],
        sign: [
            [],
            [cp('+')],
            [cp('-')],
        ],
        ws: [
            [],
            [cp(' '), 'ws'],
            [cp('\n'), 'ws'],
            [cp('\r'), 'ws'],
            [cp('\t'), 'ws'],
        ],
    } as const
    const result: RuleMap<keyof typeof map> = map
    return result
}

const deterministic = () => {
    const map = {
        json: [
            ['ws', 'element']
        ],
        value: [
            [cp('{'), 'ws', 'object', cp('}')],
            [cp('['), 'ws', 'array', cp(']')],
            ['string'],
            ['number'],
            str('true'),
            str('false'),
            str('null'),
        ],
        object: [
            [],
            ['member', 'members'],
        ],
        members:[
            [],
            [cp(','), 'ws', 'member', 'members'],
        ],
        member: [
            ['string', 'ws', cp(':'), 'ws', 'element'],
        ],
        array: [
            [],
            ['element', 'elements'],
        ],
        elements: [
            [],
            [cp(','), 'ws', 'element', 'elements'],
        ],
        element: [
            ['value', 'ws'],
        ],
        string: [
            [cp('"'), 'characters', cp('"')],
        ],
        characters: [
            [],
            ['character', 'characters'],
        ],
        character: [
            ...remove([0x20, 0x10FFFF], [cp('"'), cp('\\')]),
            [cp('\\'), 'escape'], // 92
        ],
        escape: [
            [cp('"')],
            [cp('\\')],
            [cp('/')],
            [cp('b')],
            [cp('f')],
            [cp('n')],
            [cp('r')],
            [cp('t')],
            [cp('u'), 'hex', 'hex', 'hex', 'hex'],
        ],
        hex: [
            ['digit'],
            [range('AF')],
            [range('af')],
        ],
        number: [
            ['integer', 'fraction', 'exponent'],
            [cp('-'), 'integer', 'fraction', 'exponent'],
        ],
        integer: [
            [cp('0')],
            ['onenine', 'digits'],
        ],
        digits: [
            [],
            ['digit', 'digits'],
        ],
        digit: [
            [cp('0')],
            ['onenine'],
        ],
        onenine: [
            [range('19')],
        ],
        fraction: [
            [],
            [cp('.'), 'digit', 'digits'],
        ],
        exponent: [
            [],
            [cp('E'), 'sign', 'digit', 'digits'],
            [cp('e'), 'sign', 'digit', 'digits'],
        ],
        sign: [
            [],
            [cp('+')],
            [cp('-')],
        ],
        ws: [
            [],
            [cp(' '), 'ws'],
            [cp('\n'), 'ws'],
            [cp('\r'), 'ws'],
            [cp('\t'), 'ws'],
        ],
    } as const
    const _map: RuleMap<keyof typeof map> = map
    return _map
}

export default {
    classic: () => {
        const c = classic()
        const json = stringify(toRuleMap(c.json))
        const jsonE = stringify(classicTest())
        if (json !== jsonE) {
            //console.error(json)
            //console.error(jsonE)
            throw [json, jsonE]
        }
    },
    map: () => {
        const f = parser(dispatchMap(deterministic()))
        // console.error(stringify(x))
        //
        const isSuccess = (s: readonly CodePoint[]|null) => s?.length === 0
        const expect = (s: string, success: boolean) => {
            const [a, r] = f('json', toArray(stringToCodePointList(s)))
            if (isSuccess(r) !== success) {
                throw r
            }
        }

        //
        expect('   true   ', true)
        expect('   tr2ue   ', false)
        expect('   true"   ', false)
        expect('   "Hello"   ', true)
        expect('   "Hello   ', false)
        expect('   "Hello\\n\\r\\""   ', true)
        expect('   -56.7e+5  ', true)
        expect('   h-56.7e+5   ', false)
        expect('   -56.7e+5   3', false)
        expect('   [ 12, false, "a"]  ', true)
        expect('   [ 12, false2, "a"]  ', false)
        expect('   { "q": [ 12, false, [{}], "a"] }  ', true)
        expect('   { "q": [ 12, false, [}], "a"] }  ', false)
    }
}
