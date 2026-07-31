import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth/auth";
import { SubmissionEditForm } from "@/components/submissions/SubmissionEditForm";
import { EDIT_FORMS } from "@/lib/submissions/edit-form-fields";

export const dynamic = "force-dynamic";

const spec = EDIT_FORMS.tehillim;

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rowId = parseInt(id);
  if (Number.isNaN(rowId)) notFound();

  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=/dashboard/submissions/tehillim/${rowId}/edit`
    );
  }

  // Ownership is checked by the GET the form calls, and again by the PATCH.
  // Doing it here as well would duplicate canEditRow in a third place.
  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/submissions"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to my submissions
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">{spec.heading}</h1>

      <SubmissionEditForm spec={spec} id={rowId} />
    </div>
  );
}
