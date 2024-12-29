import type { Fold } from "../types/function/operator/module.f"
import { type List, fold, last, drop, length, concat } from '../types/list/module.f.ts'
import { join } from "../types/string/module.f"

export const normalize: (path: string) => string
= path => {
    const split = path.split('/')    
    const foldResult = fold(foldNormalizeOp)([])(split)
    return join('/')(foldResult)
}

const foldNormalizeOp: Fold<string, List<string>>
 = input => state => {
    switch(input) {
        case '': { return state }
        case '..': {
            switch(last(undefined)(state)) {
                case '..': { return concat(state)([input]) }
                default: { return drop(length(state) - 1)(state) }
            }
        }
        default: { return concat(state)([input]) }
    }
}