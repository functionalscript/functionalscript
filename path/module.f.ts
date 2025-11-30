import type { Fold, Reduce, Unary } from "../types/function/operator/module.f.ts"
import { type List, fold, last, take, length, concat as listConcat } from '../types/list/module.f.ts'
import { join } from "../types/string/module.f.ts"
import { concat as stringConcat } from '../types/string/module.f.ts'

const foldNormalizeOp: Fold<string, List<string>>
= input => state => {
    switch(input) {
        case '': case '.': { return state }
        case '..': {
            switch(last(undefined)(state)) {
                case undefined:
                case '..': { return listConcat(state)([input]) }
            }
            return take(length(state) - 1)(state)
        }
        default: { return listConcat(state)([input]) }
    }
}

export const normalize: Unary<string, string>
= path => {
    const split = path.replaceAll('\\', '/').split('/')
    const foldResult = fold(foldNormalizeOp)([])(split)
    return join('/')(foldResult)
}

export const concat: Reduce<string>
= a => b => {
    const s = stringConcat([a, '/', b])
    return normalize(s)
}
