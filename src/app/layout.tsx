import type { Metadata } from "next";
import { Cormorant_Garamond, Assistant } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { Toaster } from "@/components/ui/sonner";

// Primary face: Cormorant Garamond, a Garamond revival drawn for display sizes.
//
// It ships NO Hebrew glyphs, so it cannot stand alone here — this site sets
// Hebrew dates and names inline with English. Both Tailwind tokens in
// globals.css therefore list it *ahead of* Assistant rather than replacing it:
// Latin renders as Garamond, and every Hebrew codepoint falls through to
// Assistant per-character, which is exactly how a font stack is meant to work.
// Dropping Assistant from those stacks would put Hebrew on an arbitrary OS font
// — the Urbanist bug this file used to carry.
//
// The next/font variable names MUST differ from the Tailwind theme tokens they
// feed in globals.css. Writing `--font-display: var(--font-display)` there would
// be self-referential and silently resolve to nothing.
//
// Capped at 400. Cormorant's upper weights read heavy at display sizes, so only
// the 300 and 400 instances are loaded — the variable axis above 400 is
// deliberately given up rather than left available. The ~750 `font-medium` /
// `font-semibold` / `font-bold` utilities across the app now resolve to the
// nearest loaded instance, 400. globals.css sets `font-synthesis-weight: none`
// so browsers render that as real 400 instead of faking a bold from it.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["300", "400"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// Hebrew fallback, and still the face behind every Hebrew glyph on the page.
const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["latin", "hebrew"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FrumToronto - Toronto Jewish Orthodox Community Gateway",
    template: "%s | FrumToronto",
  },
  description:
    "The Toronto Jewish Orthodox Community Gateway. Connecting the community with businesses, shuls, events, classifieds, and resources.",
  keywords: [
    "Toronto",
    "Jewish",
    "Orthodox",
    "Community",
    "Kosher",
    "Shul",
    "Synagogue",
    "Events",
    "Directory",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${assistant.variable} ${cormorant.variable} font-sans antialiased`}
      >
        <SessionProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
