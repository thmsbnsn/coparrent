import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HomeSections } from "@/components/landing/HomeSections";
import { Footer } from "@/components/landing/Footer";
import { BackToTop } from "@/components/ui/BackToTop";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HomeSections />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
};

export default Index;
