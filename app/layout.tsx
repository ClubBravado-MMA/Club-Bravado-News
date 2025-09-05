import "./globals.css";

export const metadata = {
  title: "Club Bravado MMA Live News Feed",
  description:
    "Real-time headlines for MMA, Boxing, Muay Thai, BJJ, and Amateur Wrestling.",
  // Use your logo as icons (favicon + PNG)
  icons: {
    icon: [
      { url: "/favicon.ico" },                                // if you have one
      { url: "/club-bravado-logo.png", type: "image/png" },   // fallback icon
    ],
    shortcut: [{ url: "/club-bravado-logo.png", type: "image/png" }],
    apple: [{ url: "/club-bravado-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
