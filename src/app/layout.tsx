import type { Metadata } from "next";
import { Frank_Ruhl_Libre, Assistant } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { Toaster } from "@/components/ui/sonner";

// Display face: Frank Ruhl Libre, a revival of Frank-Rühl — the typeface Hebrew
// books have been set in since 1908. Its Latin was cut alongside its Hebrew, so
// the two never clash.
//
// The next/font variable names MUST differ from the Tailwind theme tokens they
// feed in globals.css. Writing `--font-display: var(--font-display)` there would
// be self-referential and silently resolve to nothing.
//
// No `weight` array: both families are variable fonts, and listing discrete
// weights would load fixed instances and give up the axis.
const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-frank",
  subsets: ["latin", "hebrew"],
  display: "swap",
});

// UI and body face. Hebrew-first sans, so Hebrew names and dates render in the
// same family as everything else instead of falling back to an arbitrary OS font
// (Urbanist shipped no Hebrew glyphs, and was requested with subsets: ["latin"]).
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
        className={`${assistant.variable} ${frankRuhl.variable} font-sans antialiased`}
      >
        <SessionProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
