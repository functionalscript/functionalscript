import { cp, range, remove, set, str, type Rule } from '../bnf/func/module.f.ts'
import { digit, json, unicode, ws0, ws1, wsNoNewLine0 } from './json.f.ts'

export const wsModule: Rule = () => [[ws0, module]]

const module: Rule = () => [
    [json, ws0],
    [fjs],
]

const fjs: Rule = () => [
    [],
    [...str('const'), ws1, id, ws0, cp('='), ws0, json, wsNoNewLine0, fjsTail],
    [...str('export'), ws1, ...str('default'), ws1, json],
]

const fjsTail: Rule = () => [
    [],
    [cp('\n'), ws0, fjs],
]

// line comment

const lineItem: Rule = () => remove(unicode, [cp('\n')])

const line: Rule = () => [
    [],
    [lineItem, line]
]

const lineComment = () => [
    [cp('/'), commentTail, cp('\n')]
]

const multiLineSkip: Rule = () => remove(unicode, [cp('/')])

const multiLineItem: Rule = () => remove(unicode, [cp('*')])

const multiLine: Rule = () => [
    [cp('*'), multiLineTail],
    [multiLineItem, multiLine]
]

const multiLineTail: Rule = () => [
    [cp('/')],
    [multiLineSkip, multiLine]
]

const commentTail = () => [
    [cp('/'), lineComment],
    [cp('*'), multiLine],
]

// id

const id: Rule = () => [[alpha, idTail0]]

const alpha: Rule = () => [
    [range('AZ')],
    [range('az')],
    ...set('_$'),
]

const idTail0: Rule = () => [
    [],
    [alphaDigit, idTail0],
]

const alphaDigit: Rule = () => [
    [alpha],
    [digit],
]
