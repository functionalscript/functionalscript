import { string } from '../../rtti/module.f.mjs'
import { digit, uint, optionFloatSuffix } from '../json/module.f.mjs'
import { option, range } from '../module.f.mjs'

const uNumber = [uint, { n: 'n', optionFloatSuffix }]

const infinity = 'Infinity'

const negNumber = ['-', { uNumber, infinity }]

const letter = {
    lo: range('az'),
    up: range('AZ'),
    _: '_',
    $: '$',
}

const id = ['$', option({ letter, digit })]

const value  = {
    negNumber,
    uNumber,
    string,
    id, // including `null`, `true`, `false`, `undefined`, `Infinity`, `NaN`
}

// Infinity
// NaN
// const
// default
// export
// false
// null
// true
// undefined
