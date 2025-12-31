import { NextResponse } from "next/server";

// Cache for 30 minutes - weather doesn't change that often
export const revalidate = 1800;

// Toronto coordinates
const TORONTO_LAT = 43.6629;
const TORONTO_LON = -79.3957;

interface OpenWeatherResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  name: string;
}

// Map OpenWeather condition codes to our simple icons
function getConditionCode(weatherId: number): string {
  // Weather condition codes: https://openweathermap.org/weather-conditions
  if (weatherId >= 200 && weatherId < 300) return "rain"; // Thunderstorm
  if (weatherId >= 300 && weatherId < 400) return "rain"; // Drizzle
  if (weatherId >= 500 && weatherId < 600) return "rain"; // Rain
  if (weatherId >= 600 && weatherId < 700) return "snow"; // Snow
  if (weatherId >= 700 && weatherId < 800) return "cloudy"; // Atmosphere (fog, mist, etc.)
  if (weatherId === 800) return "sunny"; // Clear
  if (weatherId > 800) return "cloudy"; // Clouds
  return "cloudy";
}

export async function GET() {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Weather API key not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${TORONTO_LAT}&lon=${TORONTO_LON}&appid=${apiKey}&units=metric`,
      { next: { revalidate: 1800 } }
    );

    if (!response.ok) {
      throw new Error(`OpenWeather API error: ${response.status}`);
    }

    const data: OpenWeatherResponse = await response.json();

    // Transform to our format
    const weatherData = {
      location: "Toronto, ON",
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      condition: data.weather[0]?.description
        ? data.weather[0].description.charAt(0).toUpperCase() +
          data.weather[0].description.slice(1)
        : "Unknown",
      conditionCode: getConditionCode(data.weather[0]?.id || 800),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
      high: Math.round(data.main.temp_max),
      low: Math.round(data.main.temp_min),
      icon: data.weather[0]?.icon || "01d",
    };

    return NextResponse.json(weatherData);
  } catch (error) {
    console.error("Error fetching weather:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}
