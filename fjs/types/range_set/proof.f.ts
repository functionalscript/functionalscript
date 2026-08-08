import { assert } from "../../asserts/module.f.mjs"
import { toArray } from "../list/module.f.mjs"
import { fromRange, merge, get } from "./module.f.ts"
import { type Range } from '../range/module.f.ts'

const c = (a: string) => a.charCodeAt(0)

const range = ([a, b]: string): Range => [c(a), c(b)]

export const proof = () => {
    const digit = fromRange(range('09'))
    const initial = toArray(merge
        (fromRange(range('AZ')))
        (fromRange(range('az'))))
    const isInitial = get(initial)
    assert(!isInitial(0))
    assert(isInitial(c('a')))
    assert(!isInitial(c('1')))
    assert(isInitial(c('Z')))
    const isNext = get(toArray(merge(initial)(digit)))
    assert(isNext(c('0')))
    assert(isNext(c('A')))
    assert(!isNext(c('@')))
}
