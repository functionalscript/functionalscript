const { version } = require('./module.f.cjs')
    
const child_process = require('node:child_process')
const fs = require('node:fs') 

version({ child_process, fs })
