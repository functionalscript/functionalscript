import type { Io } from './module.f.ts'
import fs from 'node:fs'

export default {
    console,
    fs: fs
} satisfies Io