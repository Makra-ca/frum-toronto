"use client";

import Link from "next/link";
import Image from "next/image";
import { Facebook, Twitter, Mail, Phone } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <footer className="bg-blue-900 text-white">
      {/* Main footer content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt="FrumToronto"
                width={50}
                height={50}
                className="h-10 w-auto"
              />
              <span className="text-xl font-bold">FrumToronto</span>
            </div>
            <p className="text-blue-200 text-sm mb-4">
              The Toronto Jewish Orthodox Community Gateway. Connecting the
              community with businesses, shuls, events, and resources.
            </p>
            <div className="flex gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-300 transition-colors"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-300 transition-colors"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="mailto:info@frumtoronto.com"
                className="hover:text-blue-300 transition-colors"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/directory" className="text-blue-200 hover:text-white transition-colors">
                  Business Directory
                </Link>
              </li>
              <li>
                <Link href="/shuls" className="text-blue-200 hover:text-white transition-colors">
                  Shuls & Davening
                </Link>
              </li>
              <li>
                <Link href="/calendar" className="text-blue-200 hover:text-white transition-colors">
                  Events Calendar
                </Link>
              </li>
              <li>
                <Link href="/classifieds" className="text-blue-200 hover:text-white transition-colors">
                  Classifieds
                </Link>
              </li>
              <li>
                <Link href="/ask-the-rabbi" className="text-blue-200 hover:text-white transition-colors">
                  Ask The Rabbi
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/zmanim" className="text-blue-200 hover:text-white transition-colors">
                  Zmanim
                </Link>
              </li>
              <li>
                <Link href="/shiurim" className="text-blue-200 hover:text-white transition-colors">
                  Weekly Shiurim
                </Link>
              </li>
              <li>
                <Link href="/kosher-alerts" className="text-blue-200 hover:text-white transition-colors">
                  Kosher Alerts
                </Link>
              </li>
              <li>
                <Link href="/community/tehillim" className="text-blue-200 hover:text-white transition-colors">
                  Tehillim List
                </Link>
              </li>
              <li>
                <Link href="/simchas" className="text-blue-200 hover:text-white transition-colors">
                  Simchas
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-blue-200">
                <Mail className="h-4 w-4" />
                <a href="mailto:info@frumtoronto.com" className="hover:text-white transition-colors">
                  info@frumtoronto.com
                </a>
              </li>
              <li className="flex items-center gap-2 text-blue-200">
                <Phone className="h-4 w-4" />
                <span>Toronto, Ontario</span>
              </li>
            </ul>
            <div className="mt-4">
              <Link
                href="/register-business"
                className="inline-block bg-white text-blue-900 px-4 py-2 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                Register Your Business
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-blue-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-blue-200">
            <p>&copy; {currentYear} FrumToronto. All rights reserved.</p>
            <div className="flex gap-4">
              <button
                onClick={() => setPrivacyOpen(true)}
                className="hover:text-white transition-colors"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => setTermsOpen(true)}
                className="hover:text-white transition-colors"
              >
                Terms & Conditions
              </button>
              <Link href="/faq" className="hover:text-white transition-colors">
                FAQ
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Policy Dialog */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-sm leading-relaxed">
            FRUMToronto respects the privacy of its members. Contact information
            and email addresses are used for internal purposes and to contact
            members regarding new features and promotions of this site. No
            information provided to us will be sold to third party agencies.
          </DialogDescription>
        </DialogContent>
      </Dialog>

      {/* Terms & Conditions Dialog */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Terms & Conditions</DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-sm leading-relaxed">
            FRUMToronto does not take any responsibility for the Kashrus or
            reliability of any advertisements plus FRUMToronto reserves the
            right to refuse listing or advertising at our discretion.
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
