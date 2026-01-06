"use client";

import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  GitMerge,
  FolderTree,
  ImageIcon,
} from "lucide-react";
import { ReorderButtons } from "./ReorderButtons";

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
  businessCount: number;
  children?: Category[];
}

interface CategoryTableProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onMerge: (category: Category) => void;
  onReorder?: (categoryId: number, direction: "up" | "down") => Promise<void>;
}

function CategoryRow({
  category,
  depth = 0,
  onEdit,
  onDelete,
  onMerge,
  onReorder,
  expandedIds,
  toggleExpanded,
  isFirst,
  isLast,
  reorderingId,
}: {
  category: Category;
  depth?: number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onMerge: (category: Category) => void;
  onReorder?: (categoryId: number, direction: "up" | "down") => Promise<void>;
  expandedIds: Set<number>;
  toggleExpanded: (id: number) => void;
  isFirst: boolean;
  isLast: boolean;
  reorderingId: number | null;
}) {
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedIds.has(category.id);
  const canDelete = category.businessCount === 0 && (!category.children || category.children.length === 0);
  const isReordering = reorderingId === category.id;

  return (
    <>
      <TableRow className={!category.isActive ? "opacity-50" : ""}>
        <TableCell>
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${depth * 24}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => toggleExpanded(category.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
            ) : (
              <span className="w-6" />
            )}
            {category.imageUrl ? (
              <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                <img
                  src={category.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="h-4 w-4 text-gray-400" />
              </div>
            )}
            <div>
              <span className="font-medium">{category.name}</span>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-gray-500 font-mono text-sm">
          {category.slug}
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="font-normal">
            {category.businessCount}
          </Badge>
        </TableCell>
        <TableCell>
          {onReorder && (
            <ReorderButtons
              onMoveUp={() => onReorder(category.id, "up")}
              onMoveDown={() => onReorder(category.id, "down")}
              canMoveUp={!isFirst}
              canMoveDown={!isLast}
              isLoading={isReordering}
            />
          )}
        </TableCell>
        <TableCell>
          {category.isActive ? (
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-gray-500">
              Inactive
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(category)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMerge(category)}>
                <GitMerge className="h-4 w-4 mr-2" />
                Merge into...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(category)}
                disabled={!canDelete}
                className={canDelete ? "text-red-600" : "text-gray-400"}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
                {!canDelete && (
                  <span className="ml-1 text-xs">
                    ({category.businessCount > 0 ? "has businesses" : "has children"})
                  </span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {hasChildren && isExpanded && (
        <>
          {category.children!.map((child, index) => (
            <CategoryRow
              key={child.id}
              category={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onMerge={onMerge}
              onReorder={onReorder}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              isFirst={index === 0}
              isLast={index === category.children!.length - 1}
              reorderingId={reorderingId}
            />
          ))}
        </>
      )}
    </>
  );
}

export function CategoryTable({
  categories,
  onEdit,
  onDelete,
  onMerge,
  onReorder,
}: CategoryTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(
    new Set(categories.map((c) => c.id)) // Start with all expanded
  );
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  async function handleReorder(categoryId: number, direction: "up" | "down") {
    if (!onReorder) return;
    setReorderingId(categoryId);
    try {
      await onReorder(categoryId, direction);
    } finally {
      setReorderingId(null);
    }
  }

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    const allIds = new Set<number>();
    function collectIds(cats: Category[]) {
      cats.forEach((c) => {
        allIds.add(c.id);
        if (c.children) collectIds(c.children);
      });
    }
    collectIds(categories);
    setExpandedIds(allIds);
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <FolderTree className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">
          No categories found. Create your first category to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={expandAll}>
          Expand All
        </Button>
        <Button variant="ghost" size="sm" onClick={collapseAll}>
          Collapse All
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Businesses</TableHead>
              {onReorder && <TableHead className="w-[60px]">Order</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category, index) => (
              <CategoryRow
                key={category.id}
                category={category}
                onEdit={onEdit}
                onDelete={onDelete}
                onMerge={onMerge}
                onReorder={onReorder ? handleReorder : undefined}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
                isFirst={index === 0}
                isLast={index === categories.length - 1}
                reorderingId={reorderingId}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {categories.map((category, index) => (
          <MobileCategoryCard
            key={category.id}
            category={category}
            onEdit={onEdit}
            onDelete={onDelete}
            onMerge={onMerge}
            onReorder={onReorder ? handleReorder : undefined}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            isFirst={index === 0}
            isLast={index === categories.length - 1}
            reorderingId={reorderingId}
          />
        ))}
      </div>
    </div>
  );
}

function MobileCategoryCard({
  category,
  depth = 0,
  onEdit,
  onDelete,
  onMerge,
  onReorder,
  expandedIds,
  toggleExpanded,
  isFirst,
  isLast,
  reorderingId,
}: {
  category: Category;
  depth?: number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onMerge: (category: Category) => void;
  onReorder?: (categoryId: number, direction: "up" | "down") => Promise<void>;
  expandedIds: Set<number>;
  toggleExpanded: (id: number) => void;
  isFirst: boolean;
  isLast: boolean;
  reorderingId: number | null;
}) {
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedIds.has(category.id);
  const canDelete = category.businessCount === 0 && (!category.children || category.children.length === 0);
  const isReordering = reorderingId === category.id;

  return (
    <div style={{ marginLeft: `${depth * 16}px` }}>
      <div
        className={`bg-white rounded-lg border p-4 ${
          !category.isActive ? "opacity-50" : ""
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                onClick={() => toggleExpanded(category.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {category.imageUrl ? (
              <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                <img
                  src={category.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="h-5 w-5 text-gray-400" />
              </div>
            )}
            <div>
              <p className="font-medium">{category.name}</p>
              <p className="text-sm text-gray-500 font-mono">{category.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {category.isActive ? (
              <Badge className="bg-green-100 text-green-800">Active</Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500">Inactive</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{category.businessCount} businesses</Badge>
            {onReorder && (
              <ReorderButtons
                onMoveUp={() => onReorder(category.id, "up")}
                onMoveDown={() => onReorder(category.id, "down")}
                canMoveUp={!isFirst}
                canMoveDown={!isLast}
                isLoading={isReordering}
              />
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(category)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMerge(category)}>
                <GitMerge className="h-4 w-4 mr-2" />
                Merge into...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(category)}
                disabled={!canDelete}
                className={canDelete ? "text-red-600" : "text-gray-400"}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {category.children!.map((child, index) => (
            <MobileCategoryCard
              key={child.id}
              category={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onMerge={onMerge}
              onReorder={onReorder}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              isFirst={index === 0}
              isLast={index === category.children!.length - 1}
              reorderingId={reorderingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
