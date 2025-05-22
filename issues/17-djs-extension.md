# `.d.js` extension conflict (resolved)

We previously considered the `.d.js` extension for data modules. This conflicted
with TypeScript declaration files (`.d.ts`). We decided to rely solely on the
`.f.js` extension for data and code modules. Data files must end with
`export default` and contain no trailing functions.
