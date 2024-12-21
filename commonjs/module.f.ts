type PackageMap = (packageName: string) => PackageMap|Package|null

type Package = readonly[
    string,
    PackageMap,
    (fileName: string) => string|null
]
