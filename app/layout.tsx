import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Payround",
  description: "Track shared subscription payments with friends",
};

const themeInitScript = `
(function(){
  try {
    var k = 'payround-theme';
    var v = localStorage.getItem(k);
    if (v === 'light' || v === 'dark') {
      document.documentElement.setAttribute('data-theme', v);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body
        className={`${sans.className} min-h-screen bg-page text-foreground antialiased`}
      >
        <Script
          id="payround-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
