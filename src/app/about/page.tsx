import Link from "next/link";
import { Users, Globe, Heart, Handshake, Building2, Calendar, ShoppingBag, BookOpen, MapPin, Newspaper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "About Us - FrumToronto",
  description: "Learn about FrumToronto.com - the Toronto Jewish Orthodox Community Gateway",
};

export default function AboutPage() {
  const features = [
    { icon: Building2, label: "Business Directory", description: "Find local Jewish businesses", href: "/directory" },
    { icon: Calendar, label: "Events Calendar", description: "Community happenings", href: "/community/calendar" },
    { icon: ShoppingBag, label: "Classifieds", description: "Buy, sell & trade", href: "/classifieds" },
    { icon: BookOpen, label: "Ask The Rabbi", description: "Torah insights & advice", href: "/ask-the-rabbi" },
    { icon: MapPin, label: "Shul Listings", description: "Find your minyan", href: "/shuls" },
    { icon: Newspaper, label: "Alerts & News", description: "Stay informed", href: "/alerts" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              About FrumToronto
            </h1>
            <p className="text-xl text-blue-100 leading-relaxed">
              Connecting the Toronto Jewish Orthodox community with local businesses,
              shuls, events, classifieds, and resources — all in one place.
            </p>
          </div>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="container mx-auto px-4 -mt-8 relative z-10">
        <Card className="max-w-4xl mx-auto border-0 shadow-xl">
          <CardContent className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="p-4 bg-blue-100 rounded-2xl shrink-0">
                <Heart className="h-10 w-10 text-blue-700" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Our Mission</h2>
                <p className="text-gray-600 text-lg leading-relaxed">
                  FrumToronto.com is not just a community site — it&apos;s <span className="font-semibold text-blue-700">our community&apos;s site</span>.
                  With our commitment to servicing the Toronto community as a whole and as individuals,
                  we hope to be an invaluable source of information and knowledge that everyone can benefit from.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">What We Offer</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {features.map((feature) => (
            <Link key={feature.label} href={feature.href}>
              <Card className="border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all h-full cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="inline-flex p-3 bg-gray-100 rounded-xl mb-4 group-hover:bg-blue-100 transition-colors">
                    <feature.icon className="h-6 w-6 text-gray-700" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{feature.label}</h3>
                  <p className="text-sm text-gray-500">{feature.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Story Sections */}
      <div className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-16">

            {/* Growing Community */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="md:w-16 shrink-0">
                <div className="p-3 bg-blue-600 rounded-xl inline-block">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">A Growing Community</h3>
                <p className="text-gray-600 leading-relaxed">
                  Toronto is growing. Communities are expanding. New communities are developing.
                  The children are growing up, getting married and starting their own families.
                  Shuls are extending their Shiurim and other programs. New Shuls are popping up at every corner.
                  Businesses are opening and expanding their services. Every week more signs go up announcing
                  upcoming events; more announcements of engagements and other Simchas.
                  Keeping track of everything going on can be quite tricky.
                </p>
              </div>
            </div>

            {/* Digital Challenge */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="md:w-16 shrink-0">
                <div className="p-3 bg-blue-600 rounded-xl inline-block">
                  <Globe className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">The Digital Challenge</h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  At the same time, the challenges our community faces are growing as well.
                  Businesses are up against large chain department stores. They always were,
                  but these stores started selling online. They have promotions available — only online.
                  Government documents are now available online. Booking a flight? Go online.
                  Most of us rely on email for work and many companies can only be contacted through email.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  With the world as a whole going online, the need for everyone to get internet is growing.
                  Not having the internet is a self-imposed limitation to basic business operations
                  and a restriction to individual needs as well.
                </p>
              </div>
            </div>

            {/* Our Solution */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="md:w-16 shrink-0">
                <div className="p-3 bg-blue-600 rounded-xl inline-block">
                  <Handshake className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Our Solution</h3>
                <p className="text-gray-600 leading-relaxed">
                  FrumToronto.com is all about removing these limitations. We&apos;ve created one site for
                  Shul listings, business directories, community calendar, news, events, D&apos;vrei Torah
                  and advice on practically everything you can think of. One site for lost and found,
                  career opportunities and other classified type ads. Recipes, Simchas and Gemachs.
                  One site designed with everyone in mind.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-8 md:p-12">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-blue-900 mb-4">We Need Your Help</h2>
                <p className="text-blue-800 leading-relaxed">
                  We need the participation of the entire community — individuals and groups — to tell us what&apos;s going on.
                  The more everyone uses resources like the Classified section, the more beneficial they become.
                  Questions and comments are always welcome.
                </p>
              </div>
              <div className="bg-white/60 rounded-xl p-6 text-center">
                <p className="text-blue-900 font-medium">
                  What perhaps is the best thing everyone can do to support the site is to
                  <span className="font-bold"> patronize the community businesses</span>.
                  Without them there would be no community.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
