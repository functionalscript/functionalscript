import { range, remove, set, type Rule, option } from '../bnf/module.f.ts'
import { digit, json, unicode, ws0, ws1, wsNoNewLine0 } from './json.f.ts'

export const wsModule: Rule = () => [ws0, module]

const module: Rule = () => ({
    json: [json, ws0],
    fjs,
})

const fjs: Rule = () => option({
    const: ['const', ws1, id, ws0, '=', ws0, json, wsNoNewLine0, fjsTail],
    export: ['export', ws1, 'default', ws1, json],
})

const fjsTail: Rule = option(['\n', ws0, fjs])

// line comment

const lineItem: Rule = remove(unicode, set('\n'))

const line: Rule = () => option([lineItem, line])

const lineComment = () => ['/', commentTail, '\n']

const multiLineSkip: Rule = remove(unicode, set('/'))

const multiLineItem: Rule = remove(unicode, set('*'))

const multiLine: Rule = () => ({
    '*': ['*', multiLineTail],
    '_': [multiLineItem, multiLine]
})

const multiLineTail: Rule = {
    '/': '/',
    '_': [multiLineSkip, multiLine]
}

const commentTail = {
    '/': ['/', lineComment],
    '*': ['*', multiLine],
}

// id

const id: Rule = () => [alpha, idTail0]

const alpha: Rule = {
    upper: range('AZ'),
    lower: range('az'),
    _: set('_$'),
}

const idTail0: Rule = () => option([alphaDigit, idTail0])

const alphaDigit: Rule = {
    alpha,
    digit,
}
