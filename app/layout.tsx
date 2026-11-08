import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FuelMap — prix des carburants en France",
  description:
    "Carte interactive des stations-service françaises : comparez les prix du gazole, du SP95, du SP98, de l'E10, de l'E85 et du GPL autour de vous.",
  applicationName: "FuelMap",
  openGraph: {
    title: "FuelMap — prix des carburants en France",
    description:
      "Comparez les prix des carburants des stations-service françaises sur une carte interactive.",
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // on limite le zoom accidentel, sans le bloquer non plus
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a19" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
