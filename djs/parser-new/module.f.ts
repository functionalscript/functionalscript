import { descentParser } from "../../bnf/data/module.f.ts"
import {
    fullRange,
    join0Plus,
    max,
    none,
    not,
    option,
    range,
    remove,
    repeat,
    repeat0Plus,
    repeat1Plus,
    set,
    type Rule
} from "../../bnf/module.f.ts"
import { todo } from "../../dev/module.f.ts"

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
                    ...set('"\\/bfnrt'),
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

    const comment = ['/', {
            //TODO: add end of file
            oneline: ['/', option(remove(fullRange, newLine)), newLine],
            multiline: [
                '*',
                repeat0Plus({
                    na: not('*'),
                    a: ['*', not('/')]
                }),
                '*/'
            ]
        }
    ]

    const token = {
        number,
        string,
        id,
        comment,
        operator,
        ws,
        newLine
    }

    const tokens = repeat0Plus(token)

    return tokens
}