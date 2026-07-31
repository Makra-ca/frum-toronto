import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { listSubmissions } from "@/lib/submissions/list-query";

export type { Submission } from "@/lib/submissions/list-query";

/**
 * Everything the signed-in user has submitted, across content types.
 *
 * The aggregation lives in lib/submissions/list-query.ts so it can be tested
 * without going through HTTP or next-auth.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submissions = await listSubmissions(
    parseInt(session.user.id),
    session.user.role
  );

  return NextResponse.json({ submissions });
}
