import { rangeMap } from "../range_map/module.f.ts"

export const map = rangeMap({
    union: a => b => a || b,
    equal: a => b => a === b,
    def: false
})

export const fromRange = map.fromRange(true)

export const { merge, get } = map
