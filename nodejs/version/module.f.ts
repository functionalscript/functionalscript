export type Buffer = object

type Fs<T> = {
   readonly readFileSync: (name: string) => Buffer
   readonly writeFileSync: (name: string, content: string) => T
}

export type Node<T> = {
   readonly fs: Fs<T>
}

const { stringify, parse } = JSON

export const getVersion
    : <T>(fs: Fs<T>) => string
    = fs => readJson(fs)('package').version

const jsonFile = (jsonFile: string) => `${jsonFile}.json`

const readJson: <T>(node: Fs<T>) => (name: string) => any
    = fs => name => parse(fs.readFileSync(jsonFile(name)).toString())

export const updateVersion: <T>(node: Node<T>) => readonly[T, T]
    = ({ fs }) => {
        const f = (name: string) => {
            return fs.writeFileSync(
                jsonFile(name),
                stringify(
                    {
                        ...readJson(fs)(name),
                        version: getVersion(fs)
                    },
                    null,
                    2))
        }
        return [
            f('package'),
            f('deno')
        ]
    }
