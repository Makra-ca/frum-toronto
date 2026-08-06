"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X, Shield, Trash2, Bot } from "lucide-react";
import { formatInstant } from "@/lib/datetime";
import { DeleteUsersDialog, type DeletableUser } from "@/components/admin/users/DeleteUsersDialog";
import { SpamCleanupDialog } from "@/components/admin/users/SpamCleanupDialog";

interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean | null;
  isTrusted: boolean | null;
  emailVerified: Date | null;
  createdAt: Date | null;
  canAutoApproveShiva: boolean | null;
  canAutoApproveTehillim: boolean | null;
  canAutoApproveBusinesses: boolean | null;
  canAutoApproveAskTheRabbi: boolean | null;
  canAutoApproveKosherAlerts: boolean | null;
  canAutoApproveShuls: boolean | null;
  canAutoApproveSimchas: boolean | null;
  canAutoApproveEvents: boolean | null;
  canAutoApproveClassifieds: boolean | null;
  canAutoApproveShiurim: boolean | null;
  canAutoApproveAlerts: boolean | null;
  canAutoApproveBlog: boolean | null;
  canPostSpecials: boolean | null;
  canManageAskTheRabbi: boolean | null;
  commentPermission: string | null;
}

interface UserTableProps {
  users: User[];
}

const PERMISSION_LABELS: { key: keyof User; label: string }[] = [
  { key: "canAutoApproveShiva", label: "Shiva Notices" },
  { key: "canAutoApproveTehillim", label: "Tehillim Requests" },
  { key: "canAutoApproveBusinesses", label: "Business Listings" },
  { key: "canAutoApproveAskTheRabbi", label: "Ask the Rabbi" },
  { key: "canAutoApproveKosherAlerts", label: "Kosher Alerts" },
  { key: "canAutoApproveShuls", label: "Shul Directory" },
  { key: "canAutoApproveSimchas", label: "Simchas" },
  { key: "canAutoApproveEvents", label: "Events" },
  { key: "canAutoApproveClassifieds", label: "Classifieds" },
  { key: "canAutoApproveShiurim", label: "Shiurim" },
  { key: "canAutoApproveAlerts", label: "Community Alerts" },
  // Blog was in the database from the day the blog system shipped but never
  // in this dialog, so the only way to grant it was raw SQL.
  { key: "canAutoApproveBlog", label: "Blog Posts" },
  { key: "canPostSpecials", label: "Post Specials/Deals" },
];

/**
 * Many legacy-import accounts have no first or last name. Rendering
 * `{firstName} {lastName}` for those produced a blank dark line and left the
 * grey email as the only visible text, so those rows read as disabled.
 */
function displayName(user: Pick<User, "firstName" | "lastName">): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
}

export function UserTable({ users: initialUsers }: UserTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [updating, setUpdating] = useState<number | null>(null);
  const [permissionsDialogUser, setPermissionsDialogUser] = useState<User | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<DeletableUser[]>([]);
  const [spamDialogOpen, setSpamDialogOpen] = useState(false);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select-all covers the CURRENT PAGE only. The table is paginated over 3,200
  // rows, and a control that silently selected rows the admin cannot see would
  // be the worst possible affordance next to a delete button.
  const allOnPageSelected =
    users.length > 0 && users.every((u) => selectedIds.has(u.id));

  const toDeletable = (list: User[]): DeletableUser[] =>
    list.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
    }));

  const handleDeleted = (deletedIds: number[]) => {
    setUsers((prev) => prev.filter((u) => !deletedIds.includes(u.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of deletedIds) next.delete(id);
      return next;
    });
    setDeleteTargets([]);
  };

  const updateUser = async (
    userId: number,
    updates: Partial<User>
  ) => {
    setUpdating(userId);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setUsers((prev) =>
          prev.map((user) => {
            if (user.id !== userId) return user;
            const { emailVerified: emailVerifiedUpdate, ...otherUpdates } = updates;
            const updatedUser: User = { ...user, ...otherUpdates };
            if (emailVerifiedUpdate !== undefined) {
              updatedUser.emailVerified = emailVerifiedUpdate ? new Date() : null;
            }
            return updatedUser;
          })
        );
      }
    } catch (error) {
      console.error("Failed to update user:", error);
    } finally {
      setUpdating(null);
    }
  };

  const handlePermissionChange = (key: keyof User, checked: boolean) => {
    if (!permissionsDialogUser) return;
    setPermissionsDialogUser({
      ...permissionsDialogUser,
      [key]: checked,
    });
  };

  const handleSelectAllPermissions = (checked: boolean) => {
    if (!permissionsDialogUser) return;
    const updates: Partial<User> = {};
    PERMISSION_LABELS.forEach(({ key }) => {
      updates[key] = checked as never;
    });
    setPermissionsDialogUser({
      ...permissionsDialogUser,
      ...updates,
    });
  };

  const savePermissions = async () => {
    if (!permissionsDialogUser) return;
    setSavingPermissions(true);

    const updates: Record<string, boolean | string> = {};
    PERMISSION_LABELS.forEach(({ key }) => {
      updates[key] = Boolean(permissionsDialogUser[key]);
    });
    // Include new permission fields
    updates.canManageAskTheRabbi = Boolean(permissionsDialogUser.canManageAskTheRabbi);
    updates.commentPermission = permissionsDialogUser.commentPermission ?? "allowed";

    try {
      const response = await fetch(`/api/admin/users/${permissionsDialogUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === permissionsDialogUser.id
              ? { ...user, ...updates }
              : user
          )
        );
        setPermissionsDialogUser(null);
      }
    } catch (error) {
      console.error("Failed to save permissions:", error);
    } finally {
      setSavingPermissions(false);
    }
  };

  const countActivePermissions = (user: User): number => {
    return PERMISSION_LABELS.filter(({ key }) => user[key]).length;
  };

  return (
    <>
      {/* Toolbar. The bulk bar replaces the spam button when rows are ticked,
          so the two destructive controls are never adjacent. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="gap-2"
              onClick={() =>
                setDeleteTargets(
                  toDeletable(users.filter((u) => selectedIds.has(u.id)))
                )
              }
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setSpamDialogOpen(true)}
          >
            <Bot className="h-4 w-4" />
            Clear bot signups
          </Button>
        )}
      </div>

      <DeleteUsersDialog
        targets={deleteTargets}
        open={deleteTargets.length > 0}
        onOpenChange={(open) => !open && setDeleteTargets([])}
        onDeleted={handleDeleted}
      />

      <SpamCleanupDialog
        open={spamDialogOpen}
        onOpenChange={setSpamDialogOpen}
        onDeleted={handleDeleted}
      />

      {/* Permissions Dialog */}
      <Dialog
        open={!!permissionsDialogUser}
        onOpenChange={(open) => !open && setPermissionsDialogUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Auto-Approve Permissions
            </DialogTitle>
            <DialogDescription>
              {permissionsDialogUser &&
                (displayName(permissionsDialogUser)
                  ? `${displayName(permissionsDialogUser)} (${permissionsDialogUser.email})`
                  : permissionsDialogUser.email)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Select which content types this user can submit without requiring admin approval.
            </p>

            {/* Select All */}
            <div className="flex items-center justify-between pb-2 border-b">
              <Label className="font-medium">Select All</Label>
              <Checkbox
                checked={
                  permissionsDialogUser
                    ? PERMISSION_LABELS.every(({ key }) => permissionsDialogUser[key])
                    : false
                }
                onCheckedChange={(checked) => handleSelectAllPermissions(!!checked)}
              />
            </div>

            {/* Individual permissions */}
            <div className="space-y-3">
              {PERMISSION_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key} className="text-sm">
                    {label}
                  </Label>
                  <Checkbox
                    id={key}
                    checked={Boolean(permissionsDialogUser?.[key])}
                    onCheckedChange={(checked) => handlePermissionChange(key, !!checked)}
                  />
                </div>
              ))}
            </div>

            {/* Additional permissions */}
            <div className="pt-3 border-t space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Additional Permissions
              </p>

              <div className="flex items-center justify-between">
                <Label htmlFor="canManageAskTheRabbi" className="text-sm">
                  Can manage Ask the Rabbi
                </Label>
                <Checkbox
                  id="canManageAskTheRabbi"
                  checked={Boolean(permissionsDialogUser?.canManageAskTheRabbi)}
                  onCheckedChange={(checked) =>
                    setPermissionsDialogUser((prev) =>
                      prev ? { ...prev, canManageAskTheRabbi: !!checked } : prev
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="commentPermission" className="text-sm flex-1">
                  Comment permission
                </Label>
                <Select
                  value={permissionsDialogUser?.commentPermission ?? "allowed"}
                  onValueChange={(value) =>
                    setPermissionsDialogUser((prev) =>
                      prev ? { ...prev, commentPermission: value } : prev
                    )
                  }
                >
                  <SelectTrigger className="w-44 h-8 text-sm" id="commentPermission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowed">Allowed</SelectItem>
                    <SelectItem value="requires_approval">Requires Approval</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPermissionsDialogUser(null)}
              disabled={savingPermissions}
            >
              Cancel
            </Button>
            <Button onClick={savePermissions} disabled={savingPermissions}>
              {savingPermissions && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={(checked) =>
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        for (const u of users) {
                          if (checked) next.add(u.id);
                          else next.delete(u.id);
                        }
                        return next;
                      })
                    }
                    aria-label="Select all on this page"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => {
                const permCount = countActivePermissions(user);
                const name = displayName(user);
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <Checkbox
                        checked={selectedIds.has(user.id)}
                        onCheckedChange={() => toggleSelected(user.id)}
                        aria-label={`Select ${user.email}`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">
                          {name || user.email}
                        </div>
                        {name && (
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Select
                        value={user.role}
                        onValueChange={(value) => updateUser(user.id, { role: value })}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="shul">Shul Manager</SelectItem>
                          <SelectItem value="content_contributor">Content Contributor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {user.emailVerified ? (
                          <Badge className="bg-green-100 text-green-800">
                            <Check className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <>
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <X className="w-3 h-3 mr-1" />
                              Unverified
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateUser(user.id, { emailVerified: new Date() })}
                              disabled={updating === user.id}
                            >
                              Verify
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPermissionsDialogUser(user)}
                        className="gap-2"
                      >
                        <Shield className="h-4 w-4" />
                        {permCount > 0 ? (
                          <Badge variant="secondary" className="ml-1">
                            {permCount}/{PERMISSION_LABELS.length}
                          </Badge>
                        ) : (
                          "Manage"
                        )}
                      </Button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.isActive ?? true}
                          onCheckedChange={(checked) =>
                            updateUser(user.id, { isActive: checked })
                          }
                          disabled={updating === user.id}
                        />
                        {updating === user.id && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.createdAt
                        ? formatInstant(user.createdAt, { month: "numeric", day: "numeric", year: "numeric" })
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteTargets(toDeletable([user]))}
                        aria-label={`Delete ${user.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {users.map((user) => {
          const permCount = countActivePermissions(user);
          const name = displayName(user);
          return (
            <div key={user.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {name || user.email}
                  </div>
                  {name && (
                    <div className="text-sm text-gray-500">{user.email}</div>
                  )}
                </div>
                {user.emailVerified ? (
                  <Badge className="bg-green-100 text-green-800">
                    <Check className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <X className="w-3 h-3 mr-1" />
                    Unverified
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Role:</span>
                  <Select
                    value={user.role}
                    onValueChange={(value) => updateUser(user.id, { role: value })}
                    disabled={updating === user.id}
                  >
                    <SelectTrigger className="w-36 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="shul">Shul Manager</SelectItem>
                      <SelectItem value="content_contributor">Content Contributor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Auto-Approve:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPermissionsDialogUser(user)}
                    className="gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    {permCount > 0 ? `${permCount}/${PERMISSION_LABELS.length}` : "Manage"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Active:</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.isActive ?? true}
                      onCheckedChange={(checked) =>
                        updateUser(user.id, { isActive: checked })
                      }
                      disabled={updating === user.id}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Joined:</span>
                  <span className="text-sm text-gray-900">
                    {user.createdAt
                      ? formatInstant(user.createdAt, { month: "numeric", day: "numeric", year: "numeric" })
                      : "N/A"}
                  </span>
                </div>

                {!user.emailVerified && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => updateUser(user.id, { emailVerified: new Date() })}
                    disabled={updating === user.id}
                  >
                    {updating === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Verify Email
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteTargets(toDeletable([user]))}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete account
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
