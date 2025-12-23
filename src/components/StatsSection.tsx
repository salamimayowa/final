import { TrendingUp, Shield, Zap, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  {
    icon: Shield,
    value: "98.7%",
    label: "Detection Accuracy",
    color: "text-primary",
  },
  {
    icon: Zap,
    value: "<50ms",
    label: "Response Time",
    color: "text-accent",
  },
  {
    icon: Target,
    value: "6+",
    label: "Toxicity Categories",
    color: "text-warning",
  },
  {
    icon: TrendingUp,
    value: "10M+",
    label: "Comments Analyzed",
    color: "text-destructive",
  },
];

export const StatsSection = () => {
  return (
    <section className="py-16 px-4 -mt-16 relative z-20">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card 
              key={stat.label}
              className="bg-gradient-card border-border/50 shadow-lg hover:shadow-glow transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-3">
                  <div className={`${stat.color} bg-secondary/50 p-3 rounded-xl`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
                <div className="text-3xl font-heading font-bold mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
