# Documentation

## Creating a New Repository

1. Install [Node.js](https://nodejs.org/en/)
2. Create a git repo on GitHub using Node template.
3. Clone the repository.
4. Go to a root directory of the cloned repository. 
5. Run `npm init`. It should create `package.json` file.
6. Run `npm install -D typescript`.
7. Run `npx tsc --init`. It should create `tsconfig.json` file.
8. Uncomment `"allowJs": true,` and `"checkJs": true` in the `tsconfig.json` file.
9. Create an `index.js` file in the repo root.
10. Edit the `index.js` file. For example
    ```js
    module.exports = "Hello world!"
    ```
11. Go to [functionalscript.com](https://functionalscript.com) and enter `github:YOUR_GITHUB_NAME/YOUR_REPOSITORY_NAME`. Press `Build`.
