const _ = require('./index.js')

{
    const r = _.htmlToString(['html', []])
    if (r !== '<!DOCTYPE html><html></html>') { throw r }
}