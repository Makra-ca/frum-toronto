import type { NavItem } from "@/types";

export const mainNavigation: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Directory",
    href: "/directory",
    children: [
      { label: "Business Services", href: "/directory/category/business-services" },
      { label: "Restaurants & Catering", href: "/directory/category/restaurants-catering" },
      { label: "Jewish Services", href: "/directory/category/jewish-services" },
      { label: "Health & Beauty", href: "/directory/category/health-beauty" },
      { label: "Home & Garden", href: "/directory/category/home-garden" },
      { label: "Shopping", href: "/directory/category/shopping" },
      { label: "All Categories", href: "/directory" },
    ],
  },
  {
    label: "Calendar",
    href: "/calendar",
    children: [
      { label: "Events Calendar", href: "/calendar" },
      { label: "Weekly Shiurim", href: "/shiurim" },
      { label: "Zmanim", href: "/zmanim" },
    ],
  },
  {
    label: "Alerts",
    href: "/alerts",
    children: [
      { label: "Bulletins & Alerts", href: "/alerts" },
      { label: "Kosher Alerts", href: "/kosher-alerts" },
      { label: "Shiva Notifications", href: "/shiva" },
    ],
  },
  {
    label: "Classifieds",
    href: "/classifieds",
    children: [
      { label: "All Classifieds", href: "/classifieds" },
      { label: "Weekly Specials", href: "/classifieds/specials" },
      { label: "Post a Classified", href: "/classifieds/new" },
    ],
  },
  {
    label: "Shuls & Tefillos",
    href: "/shuls",
    children: [
      { label: "Shul Directory", href: "/shuls" },
      { label: "Davening Schedule", href: "/davening" },
      { label: "Mincha/Maariv List", href: "/mincha" },
      { label: "Tehillim List", href: "/community/tehillim" },
    ],
  },
  {
    label: "Community",
    href: "/community",
    children: [
      { label: "Ask The Rabbi", href: "/ask-the-rabbi" },
      { label: "Simchas", href: "/simchas" },
      { label: "Shiva Notices", href: "/shiva" },
    ],
  },
  {
    label: "Contact",
    href: "/contact",
    children: [
      { label: "Contact Us", href: "/contact" },
      { label: "Register Your Business", href: "/register-business" },
      { label: "FAQ", href: "/faq" },
      { label: "About Us", href: "/about" },
    ],
  },
];

export const businessCategories = [
  { name: "Business Services", slug: "business-services", icon: "Briefcase" },
  { name: "Clothing & Accessories", slug: "clothing-accessories", icon: "Shirt" },
  { name: "Financial Services", slug: "financial-services", icon: "DollarSign" },
  { name: "Government & Institutions", slug: "government-institutions", icon: "Building2" },
  { name: "Health & Beauty", slug: "health-beauty", icon: "Heart" },
  { name: "Home & Garden", slug: "home-garden", icon: "Home" },
  { name: "Jewish Services", slug: "jewish-services", icon: "Star" },
  { name: "Kosher Foods", slug: "kosher-foods", icon: "UtensilsCrossed" },
  { name: "Property & Accommodations", slug: "property-accommodations", icon: "Building" },
  { name: "Restaurants & Catering", slug: "restaurants-catering", icon: "ChefHat" },
  { name: "Services", slug: "services", icon: "Wrench" },
  { name: "Shopping", slug: "shopping", icon: "ShoppingBag" },
  { name: "Simchas", slug: "simchas", icon: "PartyPopper" },
  { name: "Sport & Leisure", slug: "sport-leisure", icon: "Dumbbell" },
  { name: "Transport & Auto", slug: "transport-auto", icon: "Car" },
  { name: "Education", slug: "education", icon: "GraduationCap" },
  { name: "Media & Communications", slug: "media-communications", icon: "Radio" },
  { name: "Travel", slug: "travel", icon: "Plane" },
  { name: "Other", slug: "other", icon: "MoreHorizontal" },
];
