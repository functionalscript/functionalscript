/**
 * Experimental DJS parser implementation.
 *
 * @module
 */
import { descentParser } from "../../bnf/descent/module.f.ts"
import {
    eof,
    join0Plus,
    max,
    none,
    not,
    notSet,
    oneEncode,
    option,
    range,
    remove,
    repeat,
    repeat0Plus,
    repeat1Plus,
    set,
    unicodeRange,
    type DataRule,
    type Rule
} from "../../bnf/module.f.ts"
import { todo } from "../../asserts/module.f.ts"

export const parse = (input: string): boolean => {
    const m = descentParser(jsGrammar())
    return todo()
}

export const jsGrammar = (): Rule => {

    const onenine = range('19')

    const digit: Rule = range('09')

    const string = [
        '"',
        repeat0Plus({
            ...remove(range(` ${max}`), set('"\\')),
            escape: [
                '\\',
                {
                    ...set('"\\bfnrt'),
                    solidus: '/',
                    u: [
                        'u',
                        ...repeat(4)({
                            digit,
                            AF: range('AF'),
                            af: range('af'),
                        })
                    ],
                }
            ],
        }),
        '"'
    ]

    const digits0 = repeat0Plus(digit)

    const digits = [digit, digits0]

    const number = [
        {
            0: '0',
            onenine: [onenine, digits0],
        },
        option({
            bigint: 'n',
            frac: [
                option(['.', digits]),
                option([set('Ee'), option(set('+-')), digits])
            ]
        })
    ]

    const ws = set(' \t')

    const newLine = set('\n\r')

    const idStart = {
        smallLetter: range('az'),
        bigLetter: range('AZ'),
        lowLine: '_',
        dollarSign: '$'
    }

    const idChar = {
        ...idStart,
        digit
    }

    const id = [idStart, repeat0Plus(idChar)]

    const operator = {
        '.': '.',
        '=>': '=>',
        '===': '===',
        '==': '==',
        '=': '=',
        '!==': '!==',
        '!=': '!=',
        '!': '!',
        '>>>=': '>>>=',
        '>>>': '>>>',
        '>>=': '>>=',
        '>>': '>>',
        '>=': '>=',
        '>': '>',
        '<<<<=': '<<<=',
        '<<<': '<<<',
        '<<=': '<<=',
        '<<': '<<',
        '<=': '<=',
        '<': '<',
        '+=': '+=',
        '++': '++',
        '+': '+',
        '-=': '-=',
        '--': '--',
        '-': '-',
        '**=': '**=',
        '**': '**',
        '*=': '*=',
        '*': '*',
        '/=': '/=',
        '/': '/',
        '%=': '%=',
        '%': '%',
        '&&=': '&&=',
        '&&': '&&',
        '&=': '&=',
        '&': '&',
        '||=': '||=',
        '||': '||',
        '|=': '|=',
        '|': '|',
        '^=': '^=',
        '^': '^',
        '~': '~',
        '??=': '??=',
        '??': '??',
        '?.': '?.',
        '?': '?',
        '[': '[',
        ']': ']',
        '{': '{',
        '}': '}',
        '(': '(',
        ')': ')',
        ',': ',',
        ':': ':'
    }

    // Recursive rule: tries end (*/) first at every position so **/  → content(*) + terminator(*/).
    // Falls back to the empty `unterminated` alternative at EOF instead of failing, so `comment`
    // always succeeds and the descent parser never backtracks into matching '/' and '*' as
    // separate operators. Callers detect an unterminated comment by checking for this tag.
    const multilineContent = (): DataRule => {
        const char: Rule = { na: notSet('*'), a: '*' }
        const end: Rule = ['*', '/']
        const more: Rule = [char, multilineContent]
        return { end, more, unterminated: none }
    }

    const comment = ['/', {
            // TODO: investigate why `not(commentEnd)` instead of `remove(unicodeRange, newLine)` fail tests.
            oneline: ['/', repeat0Plus(remove(unicodeRange, newLine)), option(newLine)],
            multiline: ['*', multilineContent]
        }
    ]

    const token = {
        number,
        string,
        id,
        comment,
        operator,
        ws,
        newLine,
        eof
    }

    const tokens = repeat0Plus(token)

    return tokens
}
