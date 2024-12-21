import * as text from '../../text/module.f.ts'
const { flat } = text
import * as string from '../../types/string/module.f.ts'
const { join } = string
import { rust } from './module.f.ts'
import library from '../types/testlib.f.ts'

export default join('\n')(flat('    ')(rust(library)))
