import * as string from '../../types/string/module.f.ts'
const { join } = string
import * as text from '../../text/module.f.ts'
const { flat } = text
import library from '../types/testlib.f.ts'
import { cpp } from './module.f.ts'

export default () => join('\n')(flat('    ')(cpp('My')(library)))
