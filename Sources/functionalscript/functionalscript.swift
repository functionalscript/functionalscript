protocol IAny {
    associatedtype T
}

enum Unpacked {
    case Null,
    case Undefined,
    case Bool(Bool),
    case Number(Double),
    case String([uint16]),
}

implementation IAny for Unpacked {
    type T = Unpacked
}