import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  style: "italic",
  axes: ["SOFT", "WONK", "opsz"],
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
  themeColor: "#fff8e8",
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
