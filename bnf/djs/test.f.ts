import { one } from '../../types/range/module.f.ts'
import { toTerminalRangeSequence } from '../module.f.ts'
import type { RuleMap } from './module.f.ts'

const s = toTerminalRangeSequence

const c = (a: string) => one(a.codePointAt(0) as number)

const classic = () => {
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
    const _map: RuleMap<keyof typeof map> = map
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
            ['digit'],
            ['onenine', 'digits'],
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
    const _map: RuleMap<keyof typeof map> = map
}
