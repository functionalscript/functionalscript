import { version } from './module.f.cjs'
import child_process from 'node:child_process'
import fs from 'node:fs'

version({ child_process, fs })
