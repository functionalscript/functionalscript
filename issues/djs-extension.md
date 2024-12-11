# `.d.js` extension conflict

 We use an extension `.d.js` for data JS files, but if we can't use it for TypeScript files, like `.d.ts` because it means declaration TypeScript files. There are several solutions to the problem:

1. Use only `.f.js` extension but make sure that `export default` has no functions at the end. In this case we can reference `.f.js` files as well to use functions to transform data (preferred).
2. Don't use it for TypeScript until we have type annotations in JavaScript.
