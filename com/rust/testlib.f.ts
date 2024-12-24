import { flat } from '../../text/module.f.ts'
import { join } from '../../types/string/module.f.ts'
import { rust } from './module.f.ts'
import library from '../types/testlib.f.ts'

export default join('\n')(flat('    ')(rust(library)))
