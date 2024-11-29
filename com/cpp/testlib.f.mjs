import { join } from '../../types/string/module.f.cjs'
import { flat } from '../../text/module.f.cjs'
import library from '../types/testlib.f.cjs'
import m from './module.f.mjs'
const { cpp } = m

export default () => join('\n')(flat('    ')(cpp('My')(library)))