import * as string from '../../types/string/module.f.mjs'
const { join } = string
import * as text from '../../text/module.f.mjs'
const { flat } = text
import library from '../types/testlib.f.mjs'
import { cpp } from './module.f.ts'

export default () => join('\n')(flat('    ')(cpp('My')(library)))
