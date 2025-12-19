import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white">
      {/* Background pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="container mx-auto px-4 py-16 md:py-24 relative">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            Welcome to <span className="text-blue-300">FrumToronto</span>
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-8">
            The Toronto Jewish Orthodox Community Gateway
          </p>
          <p className="text-lg text-blue-200 mb-10 max-w-2xl mx-auto">
            Connecting our community with local businesses, shuls, events,
            classifieds, and resources all in one place.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto mb-10">
            <form className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search businesses, events, classifieds..."
                  className="pl-10 h-12 bg-white text-gray-900 border-0"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 h-12 px-6"
              >
                Search
              </Button>
            </form>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              asChild
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/directory">Browse Directory</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/shuls">Find a Shul</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/calendar">View Events</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/classifieds">Classifieds</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
