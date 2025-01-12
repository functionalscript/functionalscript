import { type Result, error } from '../../types/result/module.f.ts'
import { setReplace, at, type Map } from '../../types/map/module.f.ts'
import type { DjsModule } from "../shared/module.f"

export const serializeModules: (root: string) => (modules: Map<DjsModule>) => Result<string, string>
= root => modules => {
    
    return error('error')
}

