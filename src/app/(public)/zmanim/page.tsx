import { Metadata } from "next";
import { ZmanimPageContent } from "./ZmanimPageContent";

export const metadata: Metadata = {
  title: "Zmanim - Toronto",
  description: "Daily and weekly zmanim (halachic times) for Toronto, including sunrise, sunset, candle lighting, and more.",
};

export default function ZmanimPage() {
  return <ZmanimPageContent />;
}
