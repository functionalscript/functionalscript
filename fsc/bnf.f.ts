import { set, cp, type Rule, str, range } from '../bnf/func/module.f.ts'

const moduleWs: Rule = () => [
    [ws, module, ws]
]

const ws: Rule = () => set(' \n\t\r')

const module: Rule = () => [[json]]

const json: Rule = () => [
    [number],
]

const number: Rule = () => [
    [uNumber],
    [cp('-'), uNumber],
]

const uNumber: Rule = () => [
    [uint, fraction],
]

const uint: Rule = () => [
    str('0'),
    [range('19'), digits]
]

const digits: Rule = () => [
    [],
    [digit, digits],
]

const digit: Rule = () => [
    [range('09')]
]

const fraction: Rule = () => [
    [],
    [cp('.'), digit, digits]
]
