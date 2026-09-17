import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kabarnet Eats",
  description: "Food delivery marketplace for hotels & restaurants in Kabarnet, Baringo County",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
