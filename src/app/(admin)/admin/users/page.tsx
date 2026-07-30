import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc, eq, ilike, or, and, sql } from "drizzle-orm";
import { UserTable } from "@/components/admin/UserTable";
import { UserFilters } from "@/components/admin/UserFilters";
import { PaginationLinks } from "@/components/ui/PaginationLinks";

export const metadata: Metadata = {
  title: "User Management",
};

const PAGE_SIZE = 20;

const VALID_ROLES = ["admin", "shul", "business", "content_contributor", "member"];

/** Parses ?page= defensively: junk, 0 and negatives all fall back to page 1. */
function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

async function getUsers(page: number, search: string, role: string) {
  const conditions = [];

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(ilike(users.firstName, term), ilike(users.lastName, term), ilike(users.email, term))
    );
  }
  if (role && role !== "all" && VALID_ROLES.includes(role)) {
    conditions.push(eq(users.role, role));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // The legacy import took this table from 44 rows to ~3,150. It previously
  // selected every row, with every permission column, and rendered them all in
  // a single table.
  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        isTrusted: users.isTrusted,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        canAutoApproveShiva: users.canAutoApproveShiva,
        canAutoApproveTehillim: users.canAutoApproveTehillim,
        canAutoApproveBusinesses: users.canAutoApproveBusinesses,
        canAutoApproveAskTheRabbi: users.canAutoApproveAskTheRabbi,
        canAutoApproveKosherAlerts: users.canAutoApproveKosherAlerts,
        canAutoApproveShuls: users.canAutoApproveShuls,
        canAutoApproveSimchas: users.canAutoApproveSimchas,
        canAutoApproveEvents: users.canAutoApproveEvents,
        canAutoApproveClassifieds: users.canAutoApproveClassifieds,
        canAutoApproveShiurim: users.canAutoApproveShiurim,
        canAutoApproveAlerts: users.canAutoApproveAlerts,
        canPostSpecials: users.canPostSpecials,
        canManageAskTheRabbi: users.canManageAskTheRabbi,
        commentPermission: users.commentPermission,
      })
      .from(users)
      .where(whereClause)
      // id breaks ties: the import inserted thousands of rows in batches sharing
      // a created_at, and without a stable tiebreaker OFFSET paging can repeat
      // or skip rows.
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause),
  ]);

  return { items: rows, totalCount: Number(countResult[0]?.count ?? 0) };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; role?: string }>;
}) {
  const { page: pageParam, search: searchParam, role: roleParam } = await searchParams;

  const requestedPage = parsePage(pageParam);
  const search = (searchParam ?? "").trim();
  const role = roleParam ?? "all";

  const { items: pageUsers, totalCount } = await getUsers(requestedPage, search, role);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const firstShown = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * PAGE_SIZE, totalCount);
  const isFiltered = search !== "" || (role !== "all" && role !== "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">
            Manage user roles, trust status, and account settings
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {totalCount.toLocaleString()} {isFiltered ? "matching" : "total"} user
          {totalCount === 1 ? "" : "s"}
        </div>
      </div>

      <UserFilters />

      {pageUsers.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <p className="font-medium text-gray-900">
            {totalCount > 0 ? "That page doesn't exist" : "No users match those filters"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount > 0 ? (
              <>
                There {totalPages === 1 ? "is" : "are"} only {totalPages}{" "}
                {totalPages === 1 ? "page" : "pages"} of results.
              </>
            ) : (
              "Try a different name, email or role."
            )}
          </p>
          {isFiltered && (
            <Link
              href="/admin/users"
              className="mt-4 inline-block text-sm text-blue-600 hover:underline"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            Showing {firstShown.toLocaleString()}&ndash;{lastShown.toLocaleString()} of{" "}
            {totalCount.toLocaleString()}
          </p>

          {/*
            UserTable seeds local state from this prop (useState(initialUsers)) so
            it can update rows optimistically. React would keep that stale state
            across a filter or page change, so the key forces a fresh mount per
            result set.
          */}
          <UserTable
            key={`${currentPage}|${search}|${role}`}
            users={pageUsers}
          />

          <PaginationLinks
            basePath="/admin/users"
            currentPage={currentPage}
            totalPages={totalPages}
            preserveParams={{
              search: search || undefined,
              role: role !== "all" ? role : undefined,
            }}
          />
        </>
      )}
    </div>
  );
}
