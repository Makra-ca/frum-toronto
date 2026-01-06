"use client";

import { useState, useEffect } from "react";
import { UserShulAssignment } from "@/components/admin/UserShulAssignment";
import { Loader2 } from "lucide-react";

interface Assignment {
  id: number;
  assignedAt: string | null;
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  } | null;
  shul: {
    id: number;
    name: string | null;
  } | null;
  shulName: string | null;
}

export default function UserShulsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAssignments() {
    try {
      const response = await fetch("/api/admin/user-shuls");
      if (response.ok) {
        const data = await response.json();
        setAssignments(data);
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAssignments();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shul Manager Assignments</h1>
        <p className="text-gray-500">
          Assign users to manage specific shuls
        </p>
      </div>

      <UserShulAssignment
        assignments={assignments}
        onRefresh={fetchAssignments}
      />
    </div>
  );
}
