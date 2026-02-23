export type NewsletterStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";
export type SendStatus = "pending" | "processing" | "completed" | "failed";
export type RecipientStatus = "pending" | "sent" | "failed" | "bounced";

export interface Newsletter {
  id: number;
  title: string;
  subject: string;
  previewText: string | null;
  content: string;
  contentJson: unknown | null;
  status: NewsletterStatus;
  scheduledAt: Date | string | null;
  sentAt: Date | string | null;
  createdBy: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface NewsletterSegment {
  id: number;
  name: string;
  description: string | null;
  filterCriteria: FilterCriteria | null;
  isDefault: boolean;
  createdAt: Date | string;
}

export interface FilterCriteria {
  kosherAlerts?: boolean;
  eruvStatus?: boolean;
  simchas?: boolean;
  shiva?: boolean;
  newsletter?: boolean;
  tehillim?: boolean;
  communityEvents?: boolean;
}

export interface NewsletterSend {
  id: number;
  newsletterId: number;
  segmentId: number | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  openCount: number;
  clickCount: number;
  status: SendStatus;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  errorMessage: string | null;
  // Relations
  newsletter?: Newsletter;
  segment?: NewsletterSegment;
}

export interface NewsletterRecipientLog {
  id: number;
  sendId: number;
  subscriberId: number | null;
  email: string;
  status: RecipientStatus;
  resendMessageId: string | null;
  openedAt: Date | string | null;
  clickedAt: Date | string | null;
  errorMessage: string | null;
  sentAt: Date | string | null;
}

export interface EmailSubscriber {
  id: number;
  userId: number | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  kosherAlerts: boolean;
  eruvStatus: boolean;
  simchas: boolean;
  shiva: boolean;
  newsletter: boolean;
  tehillim: boolean;
  communityEvents: boolean;
  isActive: boolean;
  unsubscribeToken: string | null;
  unsubscribedAt: Date | string | null;
  createdAt: Date | string;
}

export interface NewsletterStats {
  totalNewsletters: number;
  totalSent: number;
  totalDrafts: number;
  totalSubscribers: number;
  activeSubscribers: number;
  avgOpenRate: number;
  avgClickRate: number;
}

export interface NewsletterWithStats extends Newsletter {
  totalSent?: number;
  openRate?: number;
  clickRate?: number;
}
