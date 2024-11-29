import { join } from '../../types/string/module.f.cjs'
import text from '../../text/module.f.mjs'
const { flat } = text
import library from '../types/testlib.f.mjs'
import m from './module.f.mjs'
const { cpp } = m

export default () => join('\n')(flat('    ')(cpp('My')(library)))