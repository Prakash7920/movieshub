import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoviesHub | Your world of Tamil cinema",
  description: "Legal OTT platform for Tamil and dubbed movies.",
  metadataBase: new URL("https://example.com")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
