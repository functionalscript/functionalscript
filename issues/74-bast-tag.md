# BAST tag space

## Data

### Value Types `000X`

|           |           |JSON|
|-----------|-----------|----|
|`0000_0000`|`undefined`|    |
|`0000_0001`|`null`     |yes |
|`0000_0010`|`false`    |yes |
|`0000_0011`|`true`     |yes |
|`0000_0100`|`number`   |yes |
|`000X_XXXX`|32-5 = 27  |    |

### Reference Types `001X`

#### Immutable Reference Types `0010`

|           |           |JSON|
|-----------|-----------|----|
|`0010_0000`|`string`   |yes |
|`0010_0001`|`bigint`   |    |
|`0010_XXXX`|16-2 = 14  |    |

#### Mutable Reference Types `0011`

|           |           |JSON|
|-----------|-----------|----|
|`0011_0000`|`object`   |yes |
|`0011_0001`|`array`    |yes |
|`0011_0010`|`function` |    |
|`0011_0011`|`generator`|    |
|`0011_0100`|`Map`      |    |
|`0011_0101`|`Promise`  |    |
|`0011_XXXX`|16-2 = 10  |    |

## Operations `01XX`

Operators and function calls
