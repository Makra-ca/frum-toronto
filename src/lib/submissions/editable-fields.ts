import type { SubmissionType } from "@/lib/submissions/types";

/**
 * What a SUBMITTER may change, per type.
 *
 * A whitelist rather than a blocklist, because the failure modes of getting it
 * wrong are not symmetric: forgetting to allow a field is a support email,
 * while forgetting to block one is a user reassigning `userId`, flipping
 * `approvalStatus` to approved, or setting `broadcastAt` to dodge a guard.
 *
 * Deliberately excluded everywhere:
 *
 *   id, userId/authorId   ownership
 *   approvalStatus        self-approval
 *   broadcastAt           the once-only announcement guard
 *   rejectionReason       the admin's words, not the submitter's
 *   isActive              the admin's take-down control
 *   createdAt, updatedAt, oldId, viewCount
 *
 * Excluded per type, and worth knowing why:
 *
 *   classifieds.expiresAt   set by the server to 30 days at creation; editable
 *                           means a listing that never expires
 *   classifieds.isSpecial   a paid placement
 *   alerts.isPinned         admin decides what sits at the top of the page
 *   tehillim.isPermanent    admin decides; it is also the "never past" exemption
 *   tehillim.expiresAt      follows from isPermanent
 *   simchas.userId          see above
 */
export const EDITABLE_FIELDS: Record<SubmissionType, readonly string[]> = {
  event: [
    "title",
    "description",
    "location",
    "startTime",
    "endTime",
    "isAllDay",
    "eventType",
    "contactName",
    "contactEmail",
    "contactPhone",
    "cost",
    "imageUrl",
    "flyerUrl",
    "websiteUrl",
    "organization",
  ],
  classified: [
    "categoryId",
    "title",
    "description",
    "price",
    "priceType",
    "contactName",
    "contactEmail",
    "contactPhone",
    "location",
    "imageUrl",
  ],
  simcha: ["typeId", "familyName", "announcement", "eventDate", "location", "photoUrl"],
  kosherAlert: [
    "productName",
    "brand",
    "alertType",
    "description",
    "certifyingAgency",
    "effectiveDate",
    "issueDate",
  ],
  alert: ["alertType", "title", "content", "urgency"],
  tehillim: ["hebrewName", "englishName", "motherHebrewName", "reason"],
  shiva: [
    "niftarName",
    "niftarNameHebrew",
    "mournerNames",
    "shivaAddress",
    "shivaStart",
    "shivaEnd",
    "shivaHours",
    "daveningTimes",
    "levayaInfo",
    "zoomInfo",
    "minyanInfo",
    "attachmentUrl",
    "mealInfo",
    "donationInfo",
    "contactPhone",
  ],
  blog: [
    "title",
    "content",
    "contentJson",
    "coverImageUrl",
    "excerpt",
    "categoryId",
    "customCategory",
  ],
};
