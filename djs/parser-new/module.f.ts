import {
    descentParser,
    join0Plus,
    max,
    none,
    option,
    range,
    remove,
    repeat,
    repeat0Plus,
    set,
    type Rule
} from "../../bnf/module.f.ts"
import { todo } from "../../dev/module.f.ts"

export const parse = (input: string): boolean => {
    const m = descentParser(deterministic())
    return todo()
}

export const deterministic = (): Rule => {

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
        option('-'),
        {
            0: '0',
            onenine: [onenine, digits0],
        },
        option(['.', digits]),
        option([set('Ee'), option(set('+-')), digits])
    ]

    const ws = repeat0Plus(set(' \n\r\t'))

    const commaJoin0Plus = ([open, close]: string, a: Rule) => [
        open,
        ws,
        join0Plus([a, ws], [',', ws]),
        close,
    ]

    const value = () => ({        
        array: commaJoin0Plus('[]', value),
        object: commaJoin0Plus('{}', [string, ws, ':', ws, value]),
        string,
        number,
        true: 'true',
        false: 'false',
        null: 'null'
    })

    const json = [ws, value, ws]

    return json
}