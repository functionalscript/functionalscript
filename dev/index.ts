import { updateVersion } from './version/module.f.ts'
import { index } from "./module.f.ts"
import io from '../io/node-io.ts'

index(io)
updateVersion(io)
