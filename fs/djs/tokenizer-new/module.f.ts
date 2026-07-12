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

    // '.' and 'e'/'E' always succeed once seen, tagging missing digits as `numError`,
    // so a malformed fraction/exponent (e.g. `0.`, `0e`) fails the whole number instead
    // of silently ending it early. The sign is matched via string-literal branches
    // (not `set('+-')`) because a range-variant branch's tag is the matched character
    // itself, which would collide with the '+'/'-' operator tags in filterFunc.
    const fracPart = { withDot: ['.', { valid: digits, numError: none }], noDot: none }
    const expPart = { withExp: [set('Ee'), option({ plus: '+', minus: '-' }), { valid: digits, numError: none }], noExp: none }

    // ECMAScript disallows a NumericLiteral immediately followed by an IdentifierStart
    // or DecimalDigit (e.g. `00`, `123abc`). Consume that character into the number and
    // tag it `numError` instead of leaving it to silently start a new token. idChar is
    // wrapped in a sequence so this branch's own `numError` tag survives — a variant
    // referenced directly as another variant's branch loses the outer tag to whichever
    // of its own branches matches.
    const number = [
        {
            0: '0',
            onenine: [onenine, digits0],
        },
        option({
            bigint: 'n',
            frac: [fracPart, expPart]
        }),
        { numError: [idChar], ok: none }
    ]

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
