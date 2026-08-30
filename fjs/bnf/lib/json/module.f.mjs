import { commaJoin0Plus, option, range, remove, repeat, repeat0Plus, set, unicodeMax } from "../../module.f.mjs"

const onenine = range('19')

const digit = range('09')

const string = [
    '"',
    repeat0Plus({
        ...remove(range(` ${unicodeMax}`), set('"\\')),
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
    option('-'),
    {
        0: '0',
        onenine: [onenine, digits0],
    },
    option(['.', digits]),
    option([set('Ee'), option(set('+-')), digits])
]

const ws = repeat0Plus(set(' \n\r\t'))

const cj = commaJoin0Plus(ws)

const value = () => ({
    array: cj('[]', value),
    object: cj('{}', [string, ws, ':', ws, value]),
    string,
    number,
    true: 'true',
    false: 'false',
    null: 'null'
})

export const json = [ws, value, ws]
