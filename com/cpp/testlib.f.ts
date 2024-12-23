import { join } from '../../types/string/module.f.ts'
import { flat } from '../../text/module.f.ts'
import library from '../types/testlib.f.ts'
import { cpp } from './module.f.ts'

export default () => join('\n')(flat('    ')(cpp('My')(library)))
