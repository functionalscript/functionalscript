import _ from './module.f.mjs'
import child_process from 'node:child_process'
import fs from 'node:fs'

_.version({ child_process, fs })
