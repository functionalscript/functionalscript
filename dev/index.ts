import { updateVersion } from '../nodejs/version/module.f.ts'
import { index } from "./module.ts"
import io from '../io/node-io.ts'

index()
updateVersion(io)
