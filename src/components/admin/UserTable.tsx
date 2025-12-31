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
import { Loader2, Check, X } from "lucide-react";

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
}

interface UserTableProps {
  users: User[];
}

export function UserTable({ users: initialUsers }: UserTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [updating, setUpdating] = useState<number | null>(null);

  const updateUser = async (
    userId: number,
    updates: { role?: string; isTrusted?: boolean; isActive?: boolean; emailVerified?: boolean }
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
            // Separate emailVerified from other updates to handle type conversion
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

  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800",
    shul: "bg-indigo-100 text-indigo-800",
    business: "bg-green-100 text-green-800",
    content_contributor: "bg-blue-100 text-blue-800",
    member: "bg-gray-100 text-gray-800",
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
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
                  Trusted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
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
                            onClick={() => updateUser(user.id, { emailVerified: true })}
                            disabled={updating === user.id}
                          >
                            Verify
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.isTrusted ?? false}
                        onCheckedChange={(checked) =>
                          updateUser(user.id, { isTrusted: checked })
                        }
                        disabled={updating === user.id}
                      />
                      {updating === user.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
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
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-sm text-gray-500">{user.email}</div>
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
                <span className="text-sm text-gray-500">Trusted:</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={user.isTrusted ?? false}
                    onCheckedChange={(checked) =>
                      updateUser(user.id, { isTrusted: checked })
                    }
                    disabled={updating === user.id}
                  />
                </div>
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
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>

              {!user.emailVerified && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => updateUser(user.id, { emailVerified: true })}
                  disabled={updating === user.id}
                >
                  {updating === user.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Verify Email
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
