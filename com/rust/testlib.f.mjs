import * as text from '../../text/module.f.mjs'
const { flat } = text
import * as string from '../../types/string/module.f.mjs'
const { join } = string
import { rust } from './module.f.mjs'
import library from '../types/testlib.f.mjs'

export default join('\n')(flat('    ')(rust(library)))