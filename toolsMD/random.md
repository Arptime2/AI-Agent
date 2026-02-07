# Random Tool

Generate random numbers.

## Usage

```json
{"tool": "random", "params": {"min":1,"max":10}}
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| min | Minimum number (default: 1) |
| max | Maximum number (default: 100) |
| count | How many numbers to generate (default: 1) |

## Examples

Single number 1-100:
```
{"tool": "random", "params": {}}
```

Dice roll (1-6):
```
{"tool": "random", "params": {"max":6}}
```

Lottery numbers (5 numbers, 1-50):
```
{"tool": "random", "params": {"count":5,"max":50}}
```
