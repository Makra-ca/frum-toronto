// Shared content types for admin and public pages

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date | string;
  endTime: Date | string | null;
  isAllDay: boolean | null;
  eventType: string | null;
  shulId: number | null;
  shulName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  cost: string | null;
  imageUrl: string | null;
  approvalStatus: string | null;
  isActive: boolean | null;
}

export interface ScheduleEntry {
  start?: string;
  end?: string;
  notes?: string;
}

export interface Shiur {
  id: number;
  // Teacher info
  teacherTitle: string | null;
  teacherFirstName: string | null;
  teacherLastName: string | null;
  teacherName: string;
  // Basic info
  title: string;
  description: string | null;
  // Location
  shulId: number | null;
  shulName: string | null;
  locationName: string | null;
  locationAddress: string | null;
  locationPostalCode: string | null;
  locationArea: string | null;
  location: string | null;
  // Schedule
  schedule: Record<string, ScheduleEntry> | null;
  startDate: string | null;
  endDate: string | null;
  dayOfWeek: number | null;
  time: string | null;
  duration: number | null;
  // Classification
  category: string | null;
  classType: string | null;
  level: string | null;
  gender: string | null;
  // Contact
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  // Additional
  cost: string | null;
  projectOf: string | null;
  submitterEmail: string | null;
  isOnHold: boolean | null;
  isActive: boolean | null;
  approvalStatus: string | null;
  createdAt: string | null;
}

export interface Shul {
  id: number;
  businessId: number | null;
  rabbi: string | null;
  denomination: string | null;
  nusach: string | null;
  hasMinyan: boolean | null;
  businessName: string | null;
  businessSlug: string | null;
  address: string | null;
  phone: string | null;
  email?: string | null;
}

export interface DaveningSchedule {
  id: number;
  shulId: number | null;
  tefilahType: string | null;
  dayOfWeek: number | null;
  time: string;
  notes: string | null;
  isWinter: boolean | null;
  isSummer: boolean | null;
  isShabbos: boolean | null;
}
