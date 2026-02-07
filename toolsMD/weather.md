# Weather Tool

Get current weather and forecast for any location using Open-Meteo API.

## Usage

```json
{"tool": "weather", "params": {"lat":52.52,"lon":13.41}}
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| lat | Latitude (required) |
| lon | Longitude (required) |
| latitude | Alternative for lat |
| longitude | Alternative for lon |
| lng | Alternative for lon |

## Example Response

```json
{
  "location": { "lat": 52.52, "lon": 13.41 },
  "current": {
    "temperature": "22.5 °C",
    "feels_like": "23.1 °C",
    "humidity": "65%",
    "wind": "12.3 km/h",
    "condition": "Partly cloudy"
  },
  "forecast": {
    "today": { "high": "25°C", "low": "18°C" }
  }
}
```

## Weather Conditions

| Code | Condition |
|------|-----------|
| 0 | Clear sky |
| 1 | Mainly clear |
| 2 | Partly cloudy |
| 3 | Overcast |
| 45, 48 | Fog |
| 51-55 | Drizzle |
| 61-65 | Rain |
| 71-75 | Snow |
| 80-82 | Showers |
| 95-99 | Thunderstorm |

## Tips

- Use lat/lon coordinates (not city names)
- The AI can use geocoding to convert city names to coordinates
- Timezone is auto-detected from coordinates
