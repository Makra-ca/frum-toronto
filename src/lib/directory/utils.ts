// Directory utility functions

export interface BusinessHours {
  sunday?: { open: string; close: string } | null;
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
}

/**
 * Check if a business is currently open based on its hours
 * Uses Toronto timezone
 */
export function isBusinessOpenNow(hours: BusinessHours | null | unknown): boolean {
  if (!hours || typeof hours !== "object") return false;

  const typedHours = hours as BusinessHours;
  const now = new Date();

  // Get current day and time in Toronto timezone
  const torontoFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = torontoFormatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase();
  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const currentTime = `${hour}:${minute}`;

  if (!weekday) return false;

  const todayHours = typedHours[weekday as keyof BusinessHours];
  if (!todayHours?.open || !todayHours?.close) return false;

  // Compare times as strings (works for 24h format)
  return currentTime >= todayHours.open && currentTime <= todayHours.close;
}

/**
 * Get the current day's hours for a business
 */
export function getTodayHours(hours: BusinessHours | null | unknown): { open: string; close: string } | null {
  if (!hours || typeof hours !== "object") return null;

  const typedHours = hours as BusinessHours;
  const now = new Date();

  const weekday = now
    .toLocaleDateString("en-US", {
      timeZone: "America/Toronto",
      weekday: "long",
    })
    .toLowerCase();

  const todayHours = typedHours[weekday as keyof BusinessHours];
  if (!todayHours?.open || !todayHours?.close) return null;

  return todayHours;
}

/**
 * Format hours for display (e.g., "9:00 AM - 5:00 PM")
 */
export function formatHoursDisplay(hours: { open: string; close: string } | null): string {
  if (!hours) return "Closed";

  const formatTime = (time: string) => {
    const [hourStr, minute] = time.split(":");
    const hour = parseInt(hourStr);
    if (hour === 0) return `12:${minute} AM`;
    if (hour === 12) return `12:${minute} PM`;
    if (hour > 12) return `${hour - 12}:${minute} PM`;
    return `${hour}:${minute} AM`;
  };

  return `${formatTime(hours.open)} - ${formatTime(hours.close)}`;
}

/**
 * Generate Google Maps directions URL
 */
export function getDirectionsUrl(address: string, city?: string | null): string {
  const fullAddress = city ? `${address}, ${city}` : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;
}

/**
 * Generate Google Maps search URL
 */
export function getMapsUrl(address: string, city?: string | null): string {
  const fullAddress = city ? `${address}, ${city}` : address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}

/**
 * Format phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, "");

  // Format as (XXX) XXX-XXXX if 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Format as +X (XXX) XXX-XXXX if 11 digits
  if (digits.length === 11) {
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if not standard format
  return phone;
}

/**
 * Get tel: link for phone number
 */
export function getPhoneLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `tel:+1${digits.slice(-10)}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}
