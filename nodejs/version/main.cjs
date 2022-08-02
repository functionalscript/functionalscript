const cp = require('child_process')
const fs = require('fs')
const { version } = require('./module.f.cjs')

version(fs)(cp)