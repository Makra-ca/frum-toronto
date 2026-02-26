"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  Landmark,
  Calendar,
  Tag,
  BookOpen,
  Users,
  Clock,
  Heart,
  ChevronDown,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Community feature nodes with descriptions
const communityNodes = [
  { id: "directory", label: "Directory", description: "100+ kosher businesses", icon: Building2, href: "/directory", color: "from-blue-500 to-blue-600" },
  { id: "shuls", label: "Shuls", description: "Find your minyan", icon: Landmark, href: "/shuls", color: "from-indigo-500 to-indigo-600" },
  { id: "events", label: "Events", description: "Community calendar", icon: Calendar, href: "/community/calendar", color: "from-purple-500 to-purple-600" },
  { id: "classifieds", label: "Classifieds", description: "Buy, sell & trade", icon: Tag, href: "/classifieds", color: "from-cyan-500 to-cyan-600" },
  { id: "shiurim", label: "Shiurim", description: "Torah classes", icon: BookOpen, href: "/shiurim", color: "from-emerald-500 to-emerald-600" },
  { id: "community", label: "Community", description: "Simchas & alerts", icon: Users, href: "/community", color: "from-pink-500 to-pink-600" },
  { id: "zmanim", label: "Zmanim", description: "Daily times", icon: Clock, href: "/zmanim", color: "from-amber-500 to-amber-600" },
  { id: "simchas", label: "Simchas", description: "Celebrate together", icon: Heart, href: "/simchas", color: "from-rose-500 to-rose-600" },
];

// Star particle data (pre-generated static values to avoid hydration mismatch)
const starParticles = [
  { id: 0, left: 12, top: 8, size: 2, delay: 0, duration: 3 },
  { id: 1, left: 85, top: 15, size: 1.5, delay: 1.2, duration: 4 },
  { id: 2, left: 45, top: 22, size: 2.5, delay: 0.5, duration: 3.5 },
  { id: 3, left: 78, top: 35, size: 1, delay: 2, duration: 2.5 },
  { id: 4, left: 23, top: 42, size: 3, delay: 0.8, duration: 4 },
  { id: 5, left: 92, top: 48, size: 1.5, delay: 1.5, duration: 3 },
  { id: 6, left: 8, top: 55, size: 2, delay: 2.5, duration: 3.5 },
  { id: 7, left: 67, top: 12, size: 1, delay: 0.3, duration: 4.5 },
  { id: 8, left: 35, top: 68, size: 2.5, delay: 1.8, duration: 3 },
  { id: 9, left: 55, top: 75, size: 1.5, delay: 3, duration: 4 },
  { id: 10, left: 18, top: 82, size: 2, delay: 0.7, duration: 3.5 },
  { id: 11, left: 88, top: 88, size: 1, delay: 2.2, duration: 2.5 },
  { id: 12, left: 42, top: 92, size: 3, delay: 1, duration: 4 },
  { id: 13, left: 72, top: 5, size: 1.5, delay: 3.5, duration: 3 },
  { id: 14, left: 5, top: 28, size: 2, delay: 0.2, duration: 4.5 },
  { id: 15, left: 95, top: 62, size: 1, delay: 2.8, duration: 3.5 },
  { id: 16, left: 28, top: 18, size: 2.5, delay: 1.3, duration: 3 },
  { id: 17, left: 62, top: 45, size: 1.5, delay: 4, duration: 4 },
  { id: 18, left: 15, top: 72, size: 2, delay: 0.9, duration: 2.5 },
  { id: 19, left: 82, top: 78, size: 1, delay: 2.1, duration: 3.5 },
  { id: 20, left: 48, top: 38, size: 3, delay: 1.6, duration: 4 },
  { id: 21, left: 38, top: 85, size: 1.5, delay: 3.2, duration: 3 },
  { id: 22, left: 75, top: 25, size: 2, delay: 0.4, duration: 4.5 },
  { id: 23, left: 3, top: 95, size: 1, delay: 2.6, duration: 3.5 },
  { id: 24, left: 58, top: 58, size: 2.5, delay: 1.1, duration: 3 },
  { id: 25, left: 25, top: 52, size: 1.5, delay: 3.8, duration: 4 },
  { id: 26, left: 90, top: 32, size: 2, delay: 0.6, duration: 2.5 },
  { id: 27, left: 52, top: 8, size: 1, delay: 2.4, duration: 3.5 },
  { id: 28, left: 32, top: 35, size: 3, delay: 1.4, duration: 4 },
  { id: 29, left: 68, top: 65, size: 1.5, delay: 3.3, duration: 3 },
];

// Animated counter hook
function useCountUp(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
    }
  }, [startOnView]);

  useEffect(() => {
    if (!startOnView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasStarted, startOnView]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [hasStarted, end, duration]);

  return { count, ref };
}

// Search result type config
const searchTypeConfig = {
  business: { label: "Business", icon: Building2, color: "bg-blue-500" },
  classified: { label: "Classified", icon: Tag, color: "bg-green-500" },
  askTheRabbi: { label: "Ask the Rabbi", icon: HelpCircle, color: "bg-purple-500" },
};

interface SearchResult {
  id: number;
  type: "business" | "classified" | "askTheRabbi";
  title: string;
  description: string | null;
  url: string;
  category?: string | null;
}

export function HeroSection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeConnections, setActiveConnections] = useState<number[]>([]);
  const [orbitRotation, setOrbitRotation] = useState(0);

  // Search dropdown state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Animated stats
  const businessCount = useCountUp(100, 2000);
  const shulCount = useCountUp(50, 2000);

  // Slow orbital rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setOrbitRotation((prev) => (prev + 0.15) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Animate connections periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const numConnections = Math.floor(Math.random() * 2) + 2;
      const newConnections: number[] = [];
      for (let i = 0; i < numConnections; i++) {
        newConnections.push(Math.floor(Math.random() * 8));
      }
      setActiveConnections(newConnections);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=6`);
        const data = await res.json();
        setSearchResults(data.results || []);
        setShowDropdown(true);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 3) {
      setShowDropdown(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleResultClick = (url: string) => {
    setShowDropdown(false);
    router.push(url);
  };

  // Calculate node position with orbital rotation
  const getNodePosition = (index: number) => {
    const baseAngle = (index / communityNodes.length) * 360;
    const currentAngle = baseAngle + orbitRotation;
    const angleRad = (currentAngle * Math.PI) / 180;

    // Reduced radius to keep nodes within bounds (accounting for node size ~16% of container)
    const radius = 33; // percentage from center

    const x = Math.sin(angleRad) * radius;
    const y = Math.cos(angleRad) * radius;

    return { x, y, angle: currentAngle };
  };

  const scrollToContent = () => {
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  };

  return (
    <section
      className="relative overflow-x-clip overflow-y-visible bg-gradient-to-b from-blue-950 via-blue-900 to-slate-900 text-white pt-8 pb-16 md:pt-6 md:pb-20 lg:pt-0 lg:pb-20 min-h-[80vh] flex flex-col"
    >
      {/* Star particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {starParticles.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white star-twinkle"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative flex-1 flex flex-col xl:-mt-4 2xl:-mt-6">
        {/* Main content area */}
        <div className="flex flex-col xl:flex-row items-center gap-8 xl:gap-6 flex-1">

          {/* Left side - Text content */}
          <div className="flex-1 text-center xl:text-left max-w-xl">
            <p className="text-blue-300 font-medium tracking-wider uppercase text-sm mb-3">
              Toronto Jewish Community
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
              Welcome to{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-300 bg-[length:200%_auto] animate-gradient-shift">
                FrumToronto
              </span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100/80 mb-8">
              Your gateway to connecting with the Orthodox Jewish community.
              Discover businesses, shuls, events, and more.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mb-8">
              <div ref={searchContainerRef} className="relative max-w-md mx-auto xl:mx-0 z-[100]">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      type="search"
                      placeholder="Search businesses, classifieds..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => searchQuery.length >= 3 && searchResults.length > 0 && setShowDropdown(true)}
                      className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 focus:border-blue-400"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 animate-spin" />
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="bg-blue-500 hover:bg-blue-600 h-12 px-6"
                    disabled={searchQuery.length < 3}
                  >
                    Search
                  </Button>
                </div>

                {/* Search Dropdown */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[100]">
                    {searchResults.length > 0 ? (
                      <>
                        {searchResults.map((result) => {
                          const config = searchTypeConfig[result.type];
                          const Icon = config.icon;
                          return (
                            <button
                              key={`${result.type}-${result.id}`}
                              type="button"
                              onClick={() => handleResultClick(result.url)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors border-b border-slate-100 last:border-0"
                            >
                              <div className={`p-1.5 rounded ${config.color}`}>
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 truncate">
                                  {result.title}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {config.label}
                                  {result.category && ` - ${result.category}`}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => handleSearch({ preventDefault: () => {} } as React.FormEvent)}
                          className="w-full px-4 py-3 text-center text-sm text-blue-600 hover:bg-blue-50 font-medium transition-colors"
                        >
                          View all results for &quot;{searchQuery}&quot;
                        </button>
                      </>
                    ) : (
                      <div className="px-4 py-6 text-center text-slate-500">
                        No results found for &quot;{searchQuery}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>

            {/* Animated stats */}
            <div className="flex flex-wrap justify-center xl:justify-start gap-6 text-sm">
              <div className="text-center" ref={businessCount.ref}>
                <div className="text-2xl font-bold text-blue-300">
                  {businessCount.count}+
                </div>
                <div className="text-blue-200/60">Businesses</div>
              </div>
              <div className="text-center" ref={shulCount.ref}>
                <div className="text-2xl font-bold text-blue-300">
                  {shulCount.count}+
                </div>
                <div className="text-blue-200/60">Shuls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-300">Weekly</div>
                <div className="text-blue-200/60">Events</div>
              </div>
            </div>
          </div>

          {/* Right side - Connected community network */}
          <div className="flex-1 flex items-center justify-center">
            <div
              className="relative w-[300px] h-[300px] md:w-[380px] md:h-[380px] lg:w-[450px] lg:h-[450px] xl:w-[520px] xl:h-[520px] 2xl:w-[580px] 2xl:h-[580px]"
            >

              {/* Subtle glow rings - no borders, just soft glows */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35%] aspect-square rounded-full bg-blue-500/5 blur-sm animate-pulse-ring" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] aspect-square rounded-full bg-blue-400/5 blur-md animate-pulse-ring-delayed" />

              {/* Center hub with glow */}
              {/* Glow effect - positioned separately for proper centering */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 xl:w-56 xl:h-56 bg-blue-500/40 rounded-full blur-2xl animate-pulse z-10" />
              {/* Hub with styled text like header */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 xl:w-32 xl:h-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/50 flex items-center justify-center ring-2 ring-blue-400/40 z-20">
                <div className="text-center">
                  <div className="flex items-baseline justify-center">
                    <span className="text-[10px] md:text-xs lg:text-sm xl:text-base font-bold text-white">Frum</span>
                    <span className="text-[10px] md:text-xs lg:text-sm xl:text-base font-bold text-blue-200">Toronto</span>
                  </div>
                </div>
              </div>

              {/* Connection lines SVG */}
              <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 5 }}>
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
                {communityNodes.map((node, index) => {
                  const pos = getNodePosition(index);
                  const isActive = activeConnections.includes(index) || hoveredNode === node.id;
                  const centerX = 50;
                  const centerY = 50;
                  const nodeX = 50 + pos.x;
                  const nodeY = 50 - pos.y; // Invert Y for screen coordinates

                  return (
                    <g key={`line-${node.id}`}>
                      {/* Base line - always visible */}
                      <line
                        x1={`${centerX}%`}
                        y1={`${centerY}%`}
                        x2={`${nodeX}%`}
                        y2={`${nodeY}%`}
                        stroke="rgba(147, 197, 253, 0.25)"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                      {/* Active/animated line */}
                      <line
                        x1={`${centerX}%`}
                        y1={`${centerY}%`}
                        x2={`${nodeX}%`}
                        y2={`${nodeY}%`}
                        stroke="url(#lineGradient)"
                        strokeWidth="2.5"
                        className={`transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                      />
                      {/* Pulse dot traveling along line */}
                      {isActive && (
                        <circle r="4" fill="#60a5fa" className="animate-pulse">
                          <animateMotion
                            dur="0.8s"
                            repeatCount="1"
                            path={`M${centerX * 4},${centerY * 4} L${nodeX * 4},${nodeY * 4}`}
                          />
                        </circle>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Floating nodes with orbital movement */}
              {communityNodes.map((node, index) => {
                const pos = getNodePosition(index);
                const Icon = node.icon;
                const isHovered = hoveredNode === node.id;

                return (
                  <Link
                    key={node.id}
                    href={node.href}
                    className="absolute z-10 group"
                    style={{
                      left: `${50 + pos.x}%`,
                      top: `${50 - pos.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {/* Glow effect on hover */}
                    <div
                      className={`absolute inset-0 -m-3 rounded-xl blur-lg transition-opacity duration-300 bg-blue-400/50 ${
                        isHovered ? 'opacity-100' : 'opacity-0'
                      }`}
                    />

                    {/* Node card */}
                    <div
                      className={`
                        relative overflow-hidden
                        rounded-xl
                        bg-gradient-to-br ${node.color}
                        shadow-lg shadow-black/30
                        flex flex-col items-center justify-center
                        transition-all duration-300
                        ${isHovered
                          ? 'scale-125 shadow-xl shadow-blue-500/40 w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28'
                          : 'w-14 h-14 md:w-16 md:h-16 lg:w-[72px] lg:h-[72px] xl:w-20 xl:h-20'
                        }
                      `}
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 shimmer-effect" />

                      <Icon className={`relative z-10 text-white transition-all duration-300 ${
                        isHovered ? 'w-7 h-7 md:w-8 md:h-8 lg:w-9 lg:h-9' : 'w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 xl:w-8 xl:h-8'
                      }`} />
                      <span className={`relative z-10 text-white/90 font-medium mt-0.5 transition-all duration-300 ${
                        isHovered ? 'text-[10px] md:text-xs lg:text-sm' : 'text-[8px] md:text-[9px] lg:text-[10px] xl:text-xs'
                      }`}>
                        {node.label}
                      </span>

                      {/* Description on hover */}
                      {isHovered && (
                        <span className="relative z-10 text-white/70 text-[7px] md:text-[8px] lg:text-[9px] mt-0.5 text-center px-1">
                          {node.description}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom CTA buttons */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-8">
          <Button
            asChild
            size="lg"
            className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all duration-300 text-sm md:text-base"
          >
            <Link href="/directory">Browse Directory</Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all duration-300 text-sm md:text-base"
          >
            <Link href="/shuls">Find a Shul</Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all duration-300 text-sm md:text-base"
          >
            <Link href="/community/calendar">View Events</Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white hover:scale-105 transition-all duration-300 shadow-lg shadow-blue-500/25 text-sm md:text-base"
          >
            <Link href="/register-business">List Your Business</Link>
          </Button>
        </div>

      </div>

      {/* Scroll indicator - fixed at bottom of hero section */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
        <button
          onClick={scrollToContent}
          className="flex flex-col items-center text-blue-300/60 hover:text-blue-300 transition-colors duration-300 group"
          aria-label="Scroll down"
        >
          <span className="text-xs mb-1 opacity-0 group-hover:opacity-100 transition-opacity">Explore More</span>
          <div className="animate-bounce-slow">
            <ChevronDown className="w-6 h-6" />
          </div>
        </button>
      </div>
    </section>
  );
}
