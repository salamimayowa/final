import { Hero } from "@/components/Hero";
import { DemoSection } from "@/components/DemoSection";
import { StatsSection } from "@/components/StatsSection";
import { FeaturesSection } from "@/components/FeaturesSection";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <StatsSection />
      <DemoSection />
      <FeaturesSection />
    </div>
  );
};

export default Index;
