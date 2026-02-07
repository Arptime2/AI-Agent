const http = require('http');
const https = require('https');
const { createTool } = require('../../server-lib');

async function weather(params) {
  let lat = params.lat || params.latitude;
  let lon = params.lon || params.lng || params.longitude;

  if (!lat || !lon) {
    return { error: 'Latitude and longitude are required. Use lat/lon parameters.' };
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const current = json.current;
          const daily = json.daily;
          const current_units = json.current_units;
          const daily_units = json.daily_units;

          resolve({
            location: { lat, lon },
            current: {
              temperature: `${current.temperature_2m} ${current_units.temperature_2m}`,
              feels_like: `${current.apparent_temperature} ${current_units.apparent_temperature}`,
              humidity: `${current.relative_humidity_2m}${current_units.relative_humidity_2m}`,
              wind: `${current.wind_speed_10m} ${current_units.wind_speed_10m}`,
              condition: getWeatherCondition(current.weather_code)
            },
            forecast: {
              today: {
                high: `${daily.temperature_2m_max[0]} ${daily_units.temperature_2m_max}`,
                low: `${daily.temperature_2m_min[0]} ${daily_units.temperature_2m_min}`
              }
            }
          });
        } catch (e) {
          reject(new Error('Failed to parse weather data'));
        }
      });
    }).on('error', reject);
  });
}

function getWeatherCondition(code) {
  const codes = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
  };
  return codes[code] || 'Unknown';
}

createTool('Weather', {
  weather,
  '': weather,
  default: weather
});
