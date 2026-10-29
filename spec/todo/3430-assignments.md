## Additional Assignment Operators

**Priority:** P4
**Status:** wip — proposing identifier-target `>>=` desugaring; implementation
awaits explicit language-design approval

These operators can be transformed into two operations in VM byte code.

|Type       |Operator|Priority|
|-----------|--------|--------|
|Assignment |`+=`    |2       |
|           |`-=`    |2       |
|           |`*=`    |2       |
|           |`/=`    |2       |
|           |`%=`    |2       |
|           |`**=`   |2       |
|           |`<<=`   |2       |
|           |`>>=`   |2       |
|           |`>>>=`  |2       |
|           |`&=`    |2       |
|           |`^=`    |2       |
|           |`\|=`   |2       |
|           |`&&=`   |2       |
|           |`\|\|=` |2       |
|           |`??=`   |2       |
|Arithmetic |`++`    |3       |
|           |`--`    |3       |
