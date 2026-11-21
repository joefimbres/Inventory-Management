import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HHC Inventory",
  description: "Hiking Hawaii Cafe inventory counts and vendor order lists.",
  applicationName: "HHC Inventory",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b4332",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-ink">
        {children}
        <noscript>
          <p className="mx-auto max-w-xl px-4 py-6">
            The inventory page needs JavaScript so counts can be saved on this phone.
          </p>
        </noscript>
      </body>
    </html>
  );
}
