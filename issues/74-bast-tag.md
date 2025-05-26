# BAST tag space

## Data `0`

### Value Types `00`

|           |           |JSON|
|-----------|-----------|----|
|`00_000000`|`undefined`|    |
|`00_000001`|`null`     |yes |
|`00_000010`|`false`    |yes |
|`00_000011`|`true`     |yes |
|`00_000100`|`number`   |yes |

### Reference Types `01`

#### Immutable Reference Types `010`

|           |           |JSON|
|-----------|-----------|----|
|`010_00000`|`string`   |yes |
|`010_00001`|`bigint`   |    |

#### Mutable Reference Types `011`

|           |           |JSON|
|-----------|-----------|----|
|`011_00000`|`object`   |yes |
|`011_00001`|`array`    |yes |
|`011_00010`|`function` |    |
|`011_00011`|`generator`|    |
|`011_00011`|`Map`      |    |

## Operations `1`

Operators and function calls
