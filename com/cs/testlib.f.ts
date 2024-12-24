import { flat } from '../../text/module.f.ts'
import { join } from '../../types/string/module.f.ts'
import { cs } from './module.f.ts'
import library from '../types/testlib.f.ts'

export default join('\n')(flat('    ')(cs('My')(library)))
