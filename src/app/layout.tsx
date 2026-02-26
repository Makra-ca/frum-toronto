import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { SessionProvider } from "@/components/providers/SessionProvider";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
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
      <body className={`${urbanist.variable} font-sans antialiased`}>
        <SessionProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </SessionProvider>
      </body>
    </html>
  );
}
