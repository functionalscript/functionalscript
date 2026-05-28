import { io } from '../../io/module.ts'
import { loadModuleMap } from '../module.f.ts'
import { registerModuleMap } from './module.f.ts'
import { fromIo } from '../../io/module.f.ts'

export const run = (): Promise<void> => fromIo(io)(
    loadModuleMap(io.process.env).step(m => registerModuleMap(undefined, m)))
