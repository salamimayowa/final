import { Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Hero = () => {
  const scrollToDemo = () => {
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-hero py-24 px-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L2c+PC9zdmc+')] opacity-20"></div>
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="flex items-center justify-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">Powered by Advanced NLP & Machine Learning</span>
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl font-heading font-bold text-white text-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          Toxic Comment
          <br />
          <span className="bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
            Filtering System
          </span>
        </h1>

        <p className="text-xl text-blue-50 text-center max-w-3xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          Intelligent content moderation using state-of-the-art NLP to detect and filter toxic comments in real-time. 
          Create safer, more inclusive online communities.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <Button 
            size="lg" 
            onClick={scrollToDemo}
            className="bg-white text-primary hover:bg-white/90 shadow-lg font-medium px-8"
          >
            <Shield className="w-5 h-5 mr-2" />
            Try Demo
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
          >
            Learn More
          </Button>
        </div>
      </div>
    </section>
  );
};
