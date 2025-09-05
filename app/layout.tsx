import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "Club Bravado MMA Live News Feed",
  description:
    "Real-time headlines for MMA, Boxing, Muay Thai, BJJ, and Amateur Wrestling.",
  icons: { icon: "/club-bravado-logo.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Google AdSense loader script (include only once) */}
        <Script
          id="adsense-script"
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5339407991596298"
        />
      </head>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
