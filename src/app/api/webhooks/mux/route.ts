import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.EMAIL_FROM || "admin@frumtoronto.com";

/**
 * Verify MUX webhook signature.
 * MUX uses HMAC-SHA256 with the signing secret.
 * Format: mux-signature header is "t=<timestamp>,v1=<signature>"
 */
async function verifyMuxSignature(
  body: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = signatureHeader.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const v1Part = parts.find((p) => p.startsWith("v1="));

    if (!timestampPart || !v1Part) return false;

    const timestamp = timestampPart.slice(2);
    const signature = v1Part.slice(3);

    const payload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computedSignature === signature;
  } catch {
    return false;
  }
}

// POST /api/webhooks/mux - Receives MUX video lifecycle webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const webhookSecret = process.env.MUX_WEBHOOK_SIGNING_SECRET;

    if (!webhookSecret) {
      console.error("[MUX Webhook] MUX_WEBHOOK_SIGNING_SECRET is not set — rejecting request");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 401 });
    }

    const signatureHeader = request.headers.get("mux-signature") || "";
    const isValid = await verifyMuxSignature(body, signatureHeader, webhookSecret);
    if (!isValid) {
      console.error("[MUX Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType: string = event.type;
    const data = event.data;

    console.log(`[MUX Webhook] Received event: ${eventType}`);

    switch (eventType) {
      case "video.upload.asset_created": {
        // Upload has been received and asset is being created
        const uploadId: string = data.upload_id || event.object?.id;
        const assetId: string = data.id;

        if (!uploadId || !assetId) {
          console.error("[MUX Webhook] Missing uploadId or assetId in upload.asset_created", data);
          break;
        }

        const updated = await db
          .update(businesses)
          .set({
            muxAssetId: assetId,
            videoStatus: "processing",
            updatedAt: new Date(),
          })
          .where(eq(businesses.muxUploadId, uploadId))
          .returning({ id: businesses.id });

        if (updated.length === 0) {
          console.warn(`[MUX Webhook] No business found for uploadId: ${uploadId}`);
        } else {
          console.log(`[MUX Webhook] Business ${updated[0].id} assetId set to ${assetId}`);
        }
        break;
      }

      case "video.asset.ready": {
        // Asset processing is complete and playback is available
        const assetId: string = data.id;
        const playbackIds: Array<{ id: string; policy: string }> = data.playback_ids || [];
        const publicPlayback = playbackIds.find((p) => p.policy === "public");
        const playbackId = publicPlayback?.id;

        if (!assetId) {
          console.error("[MUX Webhook] Missing assetId in asset.ready", data);
          break;
        }

        const updateData: Partial<typeof businesses.$inferInsert> = {
          videoStatus: "ready",
          videoApprovalStatus: "pending",
          updatedAt: new Date(),
        };

        if (playbackId) {
          updateData.muxPlaybackId = playbackId;
        }

        const updated = await db
          .update(businesses)
          .set(updateData)
          .where(eq(businesses.muxAssetId, assetId))
          .returning({ id: businesses.id, name: businesses.name });

        if (updated.length === 0) {
          console.warn(`[MUX Webhook] No business found for assetId: ${assetId}`);
        } else {
          console.log(`[MUX Webhook] Business ${updated[0].id} video is ready, playbackId: ${playbackId}`);

          // Notify admin that a video is awaiting approval
          if (resend) {
            try {
              await resend.emails.send({
                from: EMAIL_FROM,
                to: ADMIN_EMAIL,
                subject: `New business video awaiting approval — ${updated[0].name}`,
                html: `
                  <p>A new business video has been uploaded and is ready for review.</p>
                  <p><strong>Business:</strong> ${updated[0].name}</p>
                  <p><a href="${APP_URL}/admin/businesses">Review in Admin Panel</a></p>
                `,
              });
            } catch (emailErr) {
              console.error("[MUX Webhook] Failed to send admin notification email:", emailErr);
            }
          }
        }
        break;
      }

      case "video.asset.errored": {
        // Asset processing failed
        const assetId: string = data.id;

        if (!assetId) {
          console.error("[MUX Webhook] Missing assetId in asset.errored", data);
          break;
        }

        await db
          .update(businesses)
          .set({
            videoStatus: "errored",
            updatedAt: new Date(),
          })
          .where(eq(businesses.muxAssetId, assetId));

        console.log(`[MUX Webhook] Asset ${assetId} errored`);
        break;
      }

      case "video.asset.deleted": {
        // Asset was deleted externally
        const assetId: string = data.id;

        if (!assetId) break;

        await db
          .update(businesses)
          .set({
            muxPlaybackId: null,
            muxAssetId: null,
            muxUploadId: null,
            videoStatus: "none",
            updatedAt: new Date(),
          })
          .where(eq(businesses.muxAssetId, assetId));

        console.log(`[MUX Webhook] Asset ${assetId} deleted externally, cleared business fields`);
        break;
      }

      default:
        console.log(`[MUX Webhook] Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[MUX Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
