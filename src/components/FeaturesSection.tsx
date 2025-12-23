import { Brain, Zap, Globe, Lock, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Brain,
    title: "Advanced NLP",
    description: "Powered by BERT and transformer models for context-aware toxicity detection",
    color: "text-primary",
  },
  {
    icon: Zap,
    title: "Real-time Processing",
    description: "Analyze and filter comments in under 50ms with high accuracy",
    color: "text-accent",
  },
  {
    icon: Globe,
    title: "Multi-language Support",
    description: "Detect toxicity across multiple languages and cultural contexts",
    color: "text-warning",
  },
  {
    icon: Lock,
    title: "Privacy First",
    description: "On-premise deployment options and GDPR-compliant data handling",
    color: "text-destructive",
  },
  {
    icon: TrendingUp,
    title: "Continuous Learning",
    description: "ML models that adapt to new patterns and improve over time",
    color: "text-primary",
  },
  {
    icon: Users,
    title: "Community Protection",
    description: "Create safer spaces by filtering harassment, hate speech, and threats",
    color: "text-accent",
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Built on cutting-edge machine learning research to protect your online community
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader>
                <div className={`${feature.color} bg-secondary/50 w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
