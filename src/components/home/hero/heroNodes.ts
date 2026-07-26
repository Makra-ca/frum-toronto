// src/components/home/hero/heroNodes.ts
//
// The eight destinations that ride the dial, in ring order. Single source of
// truth: the dial renders all eight, and the mobile layout renders the first
// three as chips (`HERO_NODES.slice(0, 3)`) rather than keeping a second list.
//
// Eight rather than nine: eight divides the ring evenly, and Shiva is
// deliberately left out of a decorative rotation. It remains in the nav and on
// /shiva.
//
// Only three destinations have a live count. The rest carry a fixed
// `description`, so no extra queries are introduced for the sake of the hub.

import {
  Landmark,
  Clock,
  Calendar,
  Building2,
  BookOpen,
  Tag,
  Heart,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

export type HeroCountKey = "businesses" | "shuls" | "events";

export interface HeroNode {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown in the hub on hover. Used verbatim when there is no countKey. */
  description: string;
  /** When set, the hub shows a live count instead of `description`. */
  countKey?: HeroCountKey;
}

export const HERO_NODES: HeroNode[] = [
  {
    id: "shuls",
    label: "Shuls",
    href: "/shuls",
    icon: Landmark,
    description: "Find your minyan",
    countKey: "shuls",
  },
  {
    id: "zmanim",
    label: "Zmanim",
    href: "/zmanim",
    icon: Clock,
    description: "Today's times",
  },
  {
    id: "events",
    label: "Events",
    href: "/community/calendar",
    icon: Calendar,
    description: "Community calendar",
    countKey: "events",
  },
  {
    id: "directory",
    label: "Directory",
    href: "/directory",
    icon: Building2,
    description: "Kosher businesses",
    countKey: "businesses",
  },
  {
    id: "shiurim",
    label: "Shiurim",
    href: "/shiurim",
    icon: BookOpen,
    description: "Torah classes near you",
  },
  {
    id: "classifieds",
    label: "Classifieds",
    href: "/classifieds",
    icon: Tag,
    description: "Buy, sell & trade",
  },
  {
    id: "simchas",
    label: "Simchas",
    href: "/simchas",
    icon: Heart,
    description: "Share your good news",
  },
  {
    id: "ask-the-rabbi",
    label: "Ask the Rabbi",
    href: "/ask-the-rabbi",
    icon: MessageCircle,
    description: "Answered questions",
  },
];

export interface HeroCounts {
  businesses: number;
  shuls: number;
  events: number;
}

/** The hub's secondary line for a node: a live count where we have one. */
export function nodeDetail(node: HeroNode, counts: HeroCounts): string {
  if (!node.countKey) return node.description;

  const n = counts[node.countKey];
  switch (node.countKey) {
    case "businesses":
      return `${n} kosher businesses`;
    case "shuls":
      return `${n} shuls in Toronto`;
    case "events":
      return n === 1 ? "1 event this week" : `${n} events this week`;
  }
}
