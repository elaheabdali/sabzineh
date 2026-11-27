import type { ReactNode } from "react";

/**
 * Root layout: locale layouts render <html>/<body> themselves
 * (dir/lang differ per locale), so this only passes children through.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
