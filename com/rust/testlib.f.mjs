import { flat } from '../../text/module.f.cjs'
import { join } from '../../types/string/module.f.cjs'
import x from './module.f.mjs'
import library from '../types/testlib.f.cjs'

const { rust } = x

export default join('\n')(flat('    ')(rust(library)))