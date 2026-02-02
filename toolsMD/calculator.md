# Calculator Tool

Perform basic math calculations.

## When to Use

Use this tool when the user asks to:
- Add, subtract, multiply, or divide numbers
- Calculate powers or square roots
- Solve any math problem

## How to Call

```json
{"next":"tool","tool":"calculator","params":{"operation":"add","a":5,"b":3}}
```

### Operations

| Operation | Parameters | Description |
|-----------|------------|-------------|
| add | a, b | Add two numbers |
| subtract | a, b | Subtract b from a |
| multiply | a, b | Multiply two numbers |
| divide | a, b | Divide a by b |
| pow | base, exp | Calculate base^exp |
| sqrt | number | Calculate square root |

### Examples

```
{"next":"tool","tool":"calculator","params":{"operation":"add","a":10,"b":5}}
{"next":"tool","tool":"calculator","params":{"operation":"multiply","a":7,"b":8}}
{"next":"tool","tool":"calculator","params":{"operation":"sqrt","number":16}}
```

## Response

Returns an object with a `result` field containing the calculated value.
