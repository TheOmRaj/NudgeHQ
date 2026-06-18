import { ClerkProvider } from "@clerk/nextjs";
import { type Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "~/styles/globals.css";
import { TRPCReactProvider } from "~/trpc/react";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NudgeHQ — Your workflow, automated",
  description: "Gmail + Google Calendar automation for SMBs. Connect your entire stack and automate the busywork.",
  icons: [{ rel: "icon", url: "/NudgeHQ_logo.png" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={spaceGrotesk.className}>
        <body>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
