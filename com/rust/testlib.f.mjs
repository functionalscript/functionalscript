import text from '../../text/module.f.mjs'
const { flat } = text
import { join } from '../../types/string/module.f.cjs'
import x from './module.f.mjs'
import library from '../types/testlib.f.mjs'

const { rust } = x

export default join('\n')(flat('    ')(rust(library)))