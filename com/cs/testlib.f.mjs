import text from '../../text/module.f.mjs'
const { flat } = text
import string from '../../types/string/module.f.mjs'
const { join } = string
import x from './module.f.mjs'
import library from '../types/testlib.f.mjs'

const { cs } = x

export default join('\n')(flat('    ')(cs('My')(library)))
