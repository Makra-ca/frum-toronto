"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, CloudRain, CloudSnow, Sun, Wind, Droplets } from "lucide-react";

// Placeholder data - will be replaced with OpenWeather API
const weatherData = {
  location: "Toronto, ON",
  temperature: -2,
  feelsLike: -7,
  condition: "Partly Cloudy",
  conditionCode: "cloudy",
  humidity: 72,
  windSpeed: 15,
  high: 1,
  low: -5,
};

const weatherIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  sunny: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
};

export function WeatherWidget() {
  const WeatherIcon = weatherIcons[weatherData.conditionCode] || Cloud;

  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center justify-between">
            <span>{weatherData.location}</span>
            <WeatherIcon className="h-8 w-8" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-5xl font-bold">{weatherData.temperature}°</span>
            <span className="text-xl text-blue-100 mb-2">C</span>
          </div>
          <p className="text-blue-100 mb-2">{weatherData.condition}</p>
          <p className="text-sm text-blue-200">
            Feels like {weatherData.feelsLike}°C
          </p>
        </CardContent>
      </div>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Sun className="h-4 w-4" />
            </div>
            <p className="font-medium text-gray-900">
              {weatherData.high}°/{weatherData.low}°
            </p>
            <p className="text-xs text-gray-500">High/Low</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Droplets className="h-4 w-4" />
            </div>
            <p className="font-medium text-gray-900">{weatherData.humidity}%</p>
            <p className="text-xs text-gray-500">Humidity</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Wind className="h-4 w-4" />
            </div>
            <p className="font-medium text-gray-900">{weatherData.windSpeed}</p>
            <p className="text-xs text-gray-500">km/h</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
