import { string } from '../../../rtti/module.f.mjs'
import {  } from '../json/module.f.mjs'
import { option, range, repeat0Plus, repeat1Plus } from '../../module.f.mjs'

/*
const uNumber = {
    finite: [uint, { n: 'n', optionFloatSuffix }],
    infinity: 'Infinity'
}

const number = [optionNeg, uNumber]

const letter = {
    lo: range('az'),
    up: range('AZ'),
    _: '_',
    $: '$',
}

const id = ['$', option({ letter, digit })]

const value  = {
    number,
    nan: 'NaN',
    string,
    false_,
    true_,
    null_,
    undefined: 'undefined',
    id,
}

const ws1 = repeat1Plus(wsSymbol)

export const datajs = [
    ws,
    repeat0Plus(['const', ws1, id, ws, '=', ws, value, ws, ';', ws]),
    'export',
    ws1,
    'default',
    ws1,
    value
]
*/
