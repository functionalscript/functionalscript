import { io } from '../../io/module.ts'
import { register } from './module.f.ts'
import { runProgram } from '../../io/module.f.ts'

export const run = () => runProgram(io)([])(register)
