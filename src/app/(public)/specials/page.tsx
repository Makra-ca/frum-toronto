"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Tag, Calendar, Store, X, ChevronLeft, ChevronRight, ExternalLink, List, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SpecialSubmitModal } from "@/components/specials/SpecialSubmitModal";

interface Special {
  id: number;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  startDate: string;
  endDate: string;
  viewCount: number;
  businessId: number | null;
  businessName: string | null;
  businessSlug: string | null;
  businessLogo: string | null;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSpecialActiveOnDate(special: Special, dateStr: string): boolean {
  return special.startDate <= dateStr && special.endDate >= dateStr;
}

// Color palette for deal pills
const DEAL_COLORS = [
  "bg-red-500 hover:bg-red-600",
  "bg-blue-500 hover:bg-blue-600",
  "bg-green-500 hover:bg-green-600",
  "bg-purple-500 hover:bg-purple-600",
  "bg-orange-500 hover:bg-orange-600",
  "bg-pink-500 hover:bg-pink-600",
  "bg-teal-500 hover:bg-teal-600",
  "bg-indigo-500 hover:bg-indigo-600",
];

function getDealColor(index: number): string {
  return DEAL_COLORS[index % DEAL_COLORS.length];
}

export default function SpecialsPage() {
  const [specials, setSpecials] = useState<Special[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecial, setSelectedSpecial] = useState<Special | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  // Auto-detect mobile and default to list view for better UX
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setViewMode("list");
      }
    };
    checkMobile();
  }, []);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);
  const today = new Date().toISOString().split("T")[0];

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    async function fetchSpecials() {
      try {
        const response = await fetch("/api/specials?showAll=true");
        if (response.ok) {
          const data = await response.json();
          setSpecials(data);
        }
      } catch (error) {
        console.error("Error fetching specials:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSpecials();
  }, []);

  function navigateMonth(direction: "prev" | "next") {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  // Build calendar days array
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Create a color map for specials (consistent colors)
  const specialColorMap = new Map<number, string>();
  specials.forEach((special, index) => {
    specialColorMap.set(special.id, getDealColor(index));
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-48 sm:w-72 h-48 sm:h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-64 sm:w-96 h-64 sm:h-96 bg-yellow-300 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-8 sm:py-12 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex p-2 sm:p-3 bg-white/10 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
              <Tag className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3">
              Weekly Specials & Deals
            </h1>
            <p className="text-base sm:text-xl text-orange-100 mb-4 sm:mb-6">
              Browse current specials and flyers from local businesses
            </p>
            <SpecialSubmitModal />
          </div>
        </div>
      </div>

      {/* Calendar Section */}
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-pulse flex flex-col items-center">
                <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
                <div className="h-64 w-full max-w-4xl bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-5xl mx-auto">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateMonth("prev")}
                  className="h-9 w-9 md:h-10 md:w-10"
                >
                  <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateMonth("next")}
                  className="h-9 w-9 md:h-10 md:w-10"
                >
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 ml-1 md:ml-2">{monthName}</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* View Toggle - More prominent on mobile */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-8 px-3"
                  >
                    <List className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">List</span>
                  </Button>
                  <Button
                    variant={viewMode === "calendar" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("calendar")}
                    className="h-8 px-3"
                  >
                    <Grid3X3 className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Calendar</span>
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={goToToday} className="h-8">
                  Today
                </Button>
              </div>
            </div>

            {/* Active Deals Legend */}
            {specials.length > 0 && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">Active Deals</h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {specials.map((special) => (
                    <button
                      key={special.id}
                      onClick={() => setSelectedSpecial(special)}
                      className={`${specialColorMap.get(special.id)} text-white text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full transition-colors`}
                    >
                      {special.businessName || special.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar Grid - Hidden on mobile by default */}
            {viewMode === "calendar" && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hidden md:block">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="py-3 text-center text-sm font-semibold text-gray-600"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, index) => {
                    if (day === null) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="min-h-[100px] bg-gray-50/50 border-b border-r border-gray-100"
                        />
                      );
                    }

                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isToday = dateStr === today;
                    const activeSpecials = specials.filter((s) => isSpecialActiveOnDate(s, dateStr));

                    return (
                      <div
                        key={day}
                        className={`min-h-[100px] p-2 border-b border-r border-gray-100 transition-colors ${
                          isToday ? "bg-orange-50" : "hover:bg-gray-50"
                        }`}
                      >
                        {/* Day Number */}
                        <div className={`text-sm font-medium mb-1 ${
                          isToday
                            ? "text-orange-600"
                            : "text-gray-700"
                        }`}>
                          {isToday ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 bg-orange-500 text-white rounded-full">
                              {day}
                            </span>
                          ) : (
                            day
                          )}
                        </div>

                        {/* Deal Pills */}
                        <div className="space-y-1">
                          {activeSpecials.slice(0, 3).map((special) => (
                            <button
                              key={special.id}
                              onClick={() => setSelectedSpecial(special)}
                              className={`w-full text-left text-xs text-white font-medium px-2 py-1 rounded truncate transition-all ${specialColorMap.get(special.id)} hover:scale-[1.02] active:scale-[0.98]`}
                            >
                              {special.businessName || special.title}
                            </button>
                          ))}
                          {activeSpecials.length > 3 && (
                            <div className="text-xs text-gray-400 pl-1">
                              +{activeSpecials.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile Calendar Grid - Compact 7-column for calendar mode on mobile */}
            {viewMode === "calendar" && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 md:hidden">
                {/* Weekday Headers - Compact */}
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                    <div
                      key={`${day}-${i}`}
                      className="py-2 text-center text-xs font-semibold text-gray-600"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days - Compact */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, index) => {
                    if (day === null) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="min-h-[60px] bg-gray-50/50 border-b border-r border-gray-100"
                        />
                      );
                    }

                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isToday = dateStr === today;
                    const activeSpecials = specials.filter((s) => isSpecialActiveOnDate(s, dateStr));

                    return (
                      <div
                        key={day}
                        className={`min-h-[60px] p-1 border-b border-r border-gray-100 transition-colors ${
                          isToday ? "bg-orange-50" : ""
                        }`}
                      >
                        {/* Day Number */}
                        <div className={`text-xs font-medium mb-0.5 text-center ${
                          isToday ? "text-orange-600" : "text-gray-700"
                        }`}>
                          {isToday ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 bg-orange-500 text-white rounded-full text-[10px]">
                              {day}
                            </span>
                          ) : (
                            day
                          )}
                        </div>

                        {/* Deal Dots - Show colored dots instead of text */}
                        <div className="flex flex-wrap gap-0.5 justify-center">
                          {activeSpecials.slice(0, 4).map((special) => (
                            <button
                              key={special.id}
                              onClick={() => setSelectedSpecial(special)}
                              className={`w-2 h-2 rounded-full ${specialColorMap.get(special.id)?.split(' ')[0]}`}
                              title={special.businessName || special.title}
                            />
                          ))}
                          {activeSpecials.length > 4 && (
                            <span className="text-[8px] text-gray-400">+{activeSpecials.length - 4}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile hint */}
                <div className="p-2 bg-gray-50 border-t border-gray-200 text-center">
                  <p className="text-xs text-gray-500">Tap a dot to view deal, or switch to List view</p>
                </div>
              </div>
            )}

            {/* List View */}
            {viewMode === "list" && specials.length > 0 && (
              <div className="space-y-3">
                {/* Group specials by business and show date range */}
                {specials.map((special) => (
                  <button
                    key={special.id}
                    onClick={() => setSelectedSpecial(special)}
                    className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      {/* Color indicator */}
                      <div className={`w-2 h-full min-h-[60px] rounded-full ${specialColorMap.get(special.id)?.split(' ')[0]} flex-shrink-0`} />

                      <div className="flex-1 min-w-0">
                        {/* Business name badge */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold text-white px-2 py-0.5 rounded-full ${specialColorMap.get(special.id)?.split(' ')[0]}`}>
                            {special.businessName || "Special Offer"}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-semibold text-gray-900 mb-1 truncate">
                          {special.title}
                        </h3>

                        {/* Description preview */}
                        {special.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {special.description}
                          </p>
                        )}

                        {/* Date range */}
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(special.startDate)} — {formatDate(special.endDate)}</span>
                        </div>
                      </div>

                      {/* Preview thumbnail for images */}
                      {special.fileType !== "pdf" && (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          <Image
                            src={special.fileUrl}
                            alt={special.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Empty State */}
            {specials.length === 0 && (
              <Card className="mt-6">
                <CardContent className="py-12 text-center">
                  <Tag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Specials Found
                  </h3>
                  <p className="text-gray-500">
                    No specials have been posted yet. Check back soon!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Deal Modal */}
      {selectedSpecial && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={() => setSelectedSpecial(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedSpecial(null)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 p-1.5 sm:p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            </button>

            {/* Image/PDF Section */}
            <div className="relative bg-gray-100">
              {selectedSpecial.fileType === "pdf" ? (
                <div className="h-[250px] sm:h-[350px] md:h-[400px]">
                  <iframe
                    src={`${selectedSpecial.fileUrl}#view=FitH`}
                    className="w-full h-full border-0"
                    title={selectedSpecial.title}
                  />
                </div>
              ) : (
                <div className="relative h-[250px] sm:h-[350px] md:h-[400px]">
                  <Image
                    src={selectedSpecial.fileUrl}
                    alt={selectedSpecial.title}
                    fill
                    className="object-contain"
                  />
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="p-4 sm:p-6">
              {/* Business Name Badge */}
              {selectedSpecial.businessName && (
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${specialColorMap.get(selectedSpecial.id)?.split(' ')[0]}`} />
                  <span className="text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    {selectedSpecial.businessName}
                  </span>
                </div>
              )}

              {/* Title */}
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
                {selectedSpecial.title}
              </h2>

              {/* Description */}
              {selectedSpecial.description && (
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
                  {selectedSpecial.description}
                </p>
              )}

              {/* Date Range */}
              <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-gray-50 rounded-lg mb-3 sm:mb-4">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Valid Period</span>
                  <p className="text-xs sm:text-sm text-gray-500 truncate sm:whitespace-normal">
                    <span className="hidden sm:inline">{formatFullDate(selectedSpecial.startDate)} — {formatFullDate(selectedSpecial.endDate)}</span>
                    <span className="sm:hidden">{formatDate(selectedSpecial.startDate)} — {formatDate(selectedSpecial.endDate)}</span>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {selectedSpecial.fileType === "pdf" && (
                  <Button asChild className="flex-1" size="sm">
                    <a href={selectedSpecial.fileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Full Flyer
                    </a>
                  </Button>
                )}
                {selectedSpecial.businessSlug && (
                  <Button variant="outline" asChild size="sm" className={selectedSpecial.fileType === "pdf" ? "" : "flex-1"}>
                    <a href={`/directory/${selectedSpecial.businessSlug}`}>
                      <Store className="h-4 w-4 mr-2" />
                      View Business
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
