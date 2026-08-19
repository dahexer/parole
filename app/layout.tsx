import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : host.startsWith("localhost") ? "http" : "https";

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "Parole — Riconosci i segnali nelle parole",
    description: "Trascrivi il parlato e individua frasi manipolative, svalutanti o di controllo in tempo reale.",
    applicationName: "Parole",
    openGraph: {
      title: "Parole",
      description: "Le parole lasciano tracce. Noi le mettiamo in luce.",
      type: "website",
      locale: "it_IT",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Parole" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Parole",
      description: "Riconosci i segnali nelle parole.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
