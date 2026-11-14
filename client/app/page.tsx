import HeroSection from "@/components/ui/hero-13";
import FeaturesSection from "@/components/ui/feature-2";
import StatsSection from "@/components/ui/stats-4";
import FAQSection from "@/components/ui/faq-3";
import { FooterSection } from "@/components/ui/footer-5";

export default function LandingPage() {
  return (
    <main className="w-full">
      {/* Hero — full-screen cinematic landing */}
      <HeroSection />

      {/* Features — GraphRAG Intelligence showcase */}
      <FeaturesSection />

      {/* Stats — Engineering metrics with glowing cards */}
      <StatsSection />

      {/* FAQ — Accordion-style questions */}
      <FAQSection />

      {/* Footer — Navigation + brand watermark */}
      <FooterSection />
    </main>
  );
}