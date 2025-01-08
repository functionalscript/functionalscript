import { one } from '../../types/range/module.f.ts'
import { toTerminalRangeSequence } from '../func/module.f.ts'
import { dispatchMap, parser, toRuleMap, type RuleMap } from './module.f.ts'
import { classic } from '../func/testlib.f.ts'
import * as j from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'

const stringify = j.stringify(sort)
//const str = j.stringify(x => x)

const s = toTerminalRangeSequence

const c = (a: string) => one(a.codePointAt(0) as number)

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
            s('true'),
            s('false'),
            s('null'),
        ],
        object: [
            [c('{'), 'ws', c('}')],
            [c('{'), 'members', c('}')],
        ],
        members: [
            ['member'],
            ['member', c(','), 'members'],
        ],
        member: [
            ['ws', 'string', 'ws', c(':'), 'element'],
        ],
        array: [
            [c('['), 'ws', c(']')],
            [c('['), 'elements', c(']')],
        ],
        elements: [
            ['element'],
            ['element', c(','), 'elements'],
        ],
        element: [
            ['ws', 'value', 'ws'],
        ],
        string: [
            [c('"'), 'characters', c('"')],
        ],
        characters: [
            [],
            ['character', 'characters'],
        ],
        character: [
            [[0x20, 0x21]],      // exclude '"' 0x22
            [[0x23, 0x5B]],      // exclude '\' 0x5C
            [[0x5D ,0x10FFFF]],  // 93-1114111
            [c('\\'), 'escape'], // 92
        ],
        escape: [
            [c('"')],
            [c('\\')],
            [c('/')],
            [c('b')],
            [c('f')],
            [c('n')],
            [c('r')],
            [c('t')],
            [c('u'), 'hex', 'hex', 'hex', 'hex'],
        ],
        hex: [
            ['digit'],
            [[0x41, 0x46]], // A-F
            [[0x61, 0x66]], // a-f
        ],
        number: [
            ['integer', 'fraction', 'exponent'],
        ],
        integer: [
            ['digit'],
            ['onenine', 'digits'],
            [c('-'), 'digit'],
            [c('-'), 'onenine', 'digits'],
        ],
        digits: [
            ['digit'],
            ['digit', 'digits'],
        ],
        digit: [
            [c('0')],
            ['onenine'],
        ],
        onenine: [
            [[0x31, 0x39]], // 1-9
        ],
        fraction: [
            [],
            [c('.'), 'digits'],
        ],
        exponent: [
            [],
            [c('E'), 'sign', 'digits'],
            [c('e'), 'sign', 'digits'],
        ],
        sign: [
            [],
            [c('+')],
            [c('-')],
        ],
        ws: [
            [],
            [c(' '), 'ws'],
            [c('\n'), 'ws'],
            [c('\r'), 'ws'],
            [c('\t'), 'ws'],
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
            [c('{'), 'ws', 'object', c('}')],
            [c('['), 'ws', 'array', c(']')],
            ['string'],
            ['number'],
            s('true'),
            s('false'),
            s('null'),
        ],
        object: [
            [],
            ['member', 'members'],
        ],
        members:[
            [],
            [c(','), 'ws', 'member', 'members'],
        ],
        member: [
            ['string', 'ws', c(':'), 'ws', 'element'],
        ],
        array: [
            [],
            ['element', 'elements'],
        ],
        elements: [
            [],
            [c(','), 'ws', 'element', 'elements'],
        ],
        element: [
            ['value', 'ws'],
        ],
        string: [
            [c('"'), 'characters', c('"')],
        ],
        characters: [
            [],
            ['character', 'characters'],
        ],
        character: [
            [[0x20, 0x21]],      // exclude '"' 0x22
            [[0x23, 0x5B]],      // exclude '\' 0x5C
            [[0x5D ,0x10FFFF]],  // 93-1114111
            [c('\\'), 'escape'], // 92
        ],
        escape: [
            [c('"')],
            [c('\\')],
            [c('/')],
            [c('b')],
            [c('f')],
            [c('n')],
            [c('r')],
            [c('t')],
            [c('u'), 'hex', 'hex', 'hex', 'hex'],
        ],
        hex: [
            ['digit'],
            [[0x41, 0x46]], // A-F
            [[0x61, 0x66]], // a-f
        ],
        number: [
            ['integer', 'fraction', 'exponent'],
            [c('-'), 'integer', 'fraction', 'exponent'],
        ],
        integer: [
            [c('0')],
            ['onenine', 'digits'],
        ],
        digits: [
            [],
            ['digit', 'digits'],
        ],
        digit: [
            [c('0')],
            ['onenine'],
        ],
        onenine: [
            [[0x31, 0x39]], // 1-9
        ],
        fraction: [
            [],
            [c('.'), 'digit', 'digits'],
        ],
        exponent: [
            [],
            [c('E'), 'sign', 'digit', 'digits'],
            [c('e'), 'sign', 'digit', 'digits'],
        ],
        sign: [
            [],
            [c('+')],
            [c('-')],
        ],
        ws: [
            [],
            [c(' '), 'ws'],
            [c('\n'), 'ws'],
            [c('\r'), 'ws'],
            [c('\t'), 'ws'],
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
