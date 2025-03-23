import type * as djs from '../module.f.ts'
import { AstConst, type AstModule } from '../ast/module.f.ts'
import { stateScan } from '../../types/list/module.f.ts'
import { type StateScan } from '../../types/function/operator/module.f.ts'
import { todo } from '../../dev/module.f.ts'

const toAstOp
    :StateScan<djs.Unknown, Map<djs.Unknown, number>, AstConst>
    = state => djs => {
        const index = state.get(djs)
        if (index === undefined)
        {
            return todo()
        }
        return [['cref', index], state]
    }

export const toAst: (djs: djs.Unknown) => AstModule
 = djs => {
    const map = new Map();    
    return todo()
 }