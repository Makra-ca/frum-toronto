"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Calendar } from "lucide-react";

export interface Shul {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  rabbi: string | null;
  denomination: string | null;
  nusach: string | null;
  hasMinyan: boolean | null;
  isActive: boolean | null;
  createdAt: string | null;
}

interface ShulTableProps {
  shuls: Shul[];
  onEdit: (shul: Shul) => void;
  onDelete: (shul: Shul) => void;
}

export function ShulTable({ shuls, onEdit, onDelete }: ShulTableProps) {
  if (shuls.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No shuls found. Create your first shul to get started.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rabbi</TableHead>
              <TableHead>Denomination</TableHead>
              <TableHead>Nusach</TableHead>
              <TableHead>Minyan</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shuls.map((shul) => (
              <TableRow key={shul.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{shul.name}</p>
                    {shul.address && (
                      <p className="text-sm text-gray-500">{shul.address}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{shul.rabbi || "-"}</TableCell>
                <TableCell>
                  {shul.denomination ? (
                    <Badge variant="secondary" className="capitalize">
                      {shul.denomination.replace("-", " ")}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {shul.nusach ? (
                    <Badge variant="outline" className="capitalize">
                      {shul.nusach.replace("-", " ")}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {shul.hasMinyan ? (
                    <Badge className="bg-green-100 text-green-800">Yes</Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/shuls/${shul.id}/davening`}>
                      <Button variant="outline" size="sm">
                        <Calendar className="h-4 w-4 mr-1" />
                        Davening
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(shul)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => onDelete(shul)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {shuls.map((shul) => (
          <div key={shul.id} className="bg-white rounded-lg shadow p-4">
            <div className="mb-3">
              <p className="font-medium text-gray-900">{shul.name}</p>
              {shul.address && (
                <p className="text-sm text-gray-500">{shul.address}</p>
              )}
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Rabbi:</span>
                <span>{shul.rabbi || "-"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Denomination:</span>
                {shul.denomination ? (
                  <Badge variant="secondary" className="capitalize">
                    {shul.denomination.replace("-", " ")}
                  </Badge>
                ) : (
                  <span>-</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Nusach:</span>
                {shul.nusach ? (
                  <Badge variant="outline" className="capitalize">
                    {shul.nusach.replace("-", " ")}
                  </Badge>
                ) : (
                  <span>-</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Minyan:</span>
                {shul.hasMinyan ? (
                  <Badge className="bg-green-100 text-green-800">Yes</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Link href={`/admin/shuls/${shul.id}/davening`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <Calendar className="h-4 w-4 mr-1" />
                  Davening
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(shul)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => onDelete(shul)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
