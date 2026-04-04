import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

interface PublicLayoutProps {
  children: ReactNode;
}

export const PublicLayout = ({ children }: PublicLayoutProps) => {
  return (
    <div className="page-background-public min-h-screen overflow-x-clip bg-background flex flex-col">
      <Navbar />
      <main className="relative flex-1 pt-20 lg:pt-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(33,176,254,0.08),transparent_52%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.08),transparent_42%)]" />
        <div className="page-shell-public relative px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};
