import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { EmulatorBanner } from "@/components/emulator-banner";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800"],
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
    if (v !== 'light' && v !== 'dark') {
      v = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', v);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <body
        className={`${sans.className} min-h-screen bg-page text-foreground antialiased`}
      >
        <Script
          id="payround-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <AuthProvider>
          <I18nProvider>
            <EmulatorBanner />
            {children}
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
