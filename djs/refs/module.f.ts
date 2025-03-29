import type * as djs from '../module.f.ts'
import { type Fold } from '../../types/function/operator/module.f.ts'
import type * as O from '../../types/object/module.f.ts'
import { fold } from '../../types/list/module.f.ts'
import * as list from '../../types/list/module.f.ts'
const { map } = list
const { entries } = Object

type RefCounter = [number, number]

type Entry = O.Entry<djs.Unknown>

const entryValue
    : (kv: readonly[string, djs.Unknown]) => djs.Unknown
    = kv =>
    {
        return kv[1]
    }

const countRefsOp
    :Fold<djs.Unknown, Map<djs.Unknown, RefCounter>>
    = djs => refs => {
        switch (typeof djs) {
            case 'boolean': { return refs }
            case 'number':
            case 'string':
            case 'bigint': { return addRef(djs)(refs) }
            default: {
                if (djs === null) { return refs }
                if (djs === undefined) { return refs }
                if (djs instanceof Array) {
                    if (refs.has(djs))
                        return addRef(djs)(refs)
                    return addRef(djs)(fold(countRefsOp)(refs)(djs))
                }

                if (refs.has(djs))
                    return addRef(djs)(refs)

                return addRef(djs)(fold(countRefsOp)(refs)(map(entryValue)(entries(djs))))
            }
        }
}

const addRef
    :Fold<djs.Unknown, Map<djs.Unknown, RefCounter>>
    = djs => refs => {
        const refCounter = refs.get(djs)
        if (refCounter === undefined)
        {
            return refs.set(djs, [refs.size, 1])
        }
        return refs.set(djs, [refCounter[0], refCounter[1] + 1])
    }

export const countRefs
    :(djs: djs.Unknown) => Map<djs.Unknown, RefCounter>
    = djs => {
        return countRefsOp(djs)(new Map())
    }