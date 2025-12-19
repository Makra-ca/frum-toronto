import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  variable: "--font-inter",
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
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
