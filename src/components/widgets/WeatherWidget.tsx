"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Cloud, CloudRain, CloudSnow, Sun, Wind, Droplets, Loader2, Thermometer } from "lucide-react";

interface WeatherData {
  location: string;
  temperature: number;
  feelsLike: number;
  condition: string;
  conditionCode: string;
  humidity: number;
  windSpeed: number;
  high: number;
  low: number;
}

const weatherIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  sunny: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
};

const weatherGradients: Record<string, string> = {
  sunny: "from-amber-400 via-orange-400 to-yellow-500",
  cloudy: "from-slate-400 via-slate-500 to-slate-600",
  rain: "from-slate-500 via-blue-600 to-slate-700",
  snow: "from-sky-300 via-blue-400 to-indigo-500",
};

export function WeatherWidget() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setWeatherData(data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch weather:", err);
        setError("Failed to load weather");
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden rounded-2xl">
        <div className="bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 text-white p-6">
          <p className="text-sm font-medium opacity-90 mb-2">Toronto, ON</p>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-white/80" />
          </div>
        </div>
      </Card>
    );
  }

  if (error || !weatherData) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden rounded-2xl">
        <div className="bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 text-white p-6">
          <p className="text-sm font-medium opacity-90 mb-2">Toronto, ON</p>
          <p className="text-white/70">Unable to load weather</p>
        </div>
      </Card>
    );
  }

  const WeatherIcon = weatherIcons[weatherData.conditionCode] || Cloud;
  const gradient = weatherGradients[weatherData.conditionCode] || weatherGradients.cloudy;

  return (
    <Card className="border-0 shadow-lg overflow-hidden rounded-2xl">
      <div className={`bg-gradient-to-br ${gradient} text-white relative`}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-black/10 rounded-full blur-3xl" />
        </div>

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-white/80">Current Weather</p>
              <p className="text-lg font-semibold">{weatherData.location}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5">
              <WeatherIcon className="h-7 w-7" />
            </div>
          </div>

          {/* Temperature */}
          <div className="mb-4">
            <div className="flex items-start">
              <span className="text-6xl font-light tracking-tight">{weatherData.temperature}</span>
              <span className="text-2xl font-light mt-2">°C</span>
            </div>
            <p className="text-white/90 font-medium mt-1">{weatherData.condition}</p>
          </div>

          {/* Feels like & High/Low */}
          <div className="flex items-center gap-4 text-sm text-white/80">
            <div className="flex items-center gap-1.5">
              <Thermometer className="h-4 w-4" />
              <span>Feels {weatherData.feelsLike}°</span>
            </div>
            <div className="w-px h-4 bg-white/30" />
            <span>H: {weatherData.high}° L: {weatherData.low}°</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="bg-black/15 backdrop-blur-sm px-5 py-3">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-white/70" />
              <span className="text-white/90">{weatherData.humidity}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-white/70" />
              <span className="text-white/90">{weatherData.windSpeed} km/h</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
