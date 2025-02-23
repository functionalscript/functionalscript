import type { Io } from './module.f.ts'
import fs from 'node:fs'
import process from "node:process";

export default {
    console,
    fs,
    process
} satisfies Io