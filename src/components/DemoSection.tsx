import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { initToxicityDetector, analyzeToxicity, filterToxicWords } from "@/lib/toxicityDetector";

export const DemoSection = () => {
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelStatus, setModelStatus] = useState("Initializing BERT model...");
  const [result, setResult] = useState<{
    original: string;
    filtered: string;
    isToxic: boolean;
    toxicityScore: number;
    categories: string[];
  } | null>(null);

  useEffect(() => {
    // Initialize the model on component mount
    const loadModel = async () => {
      try {
        await initToxicityDetector((progress) => {
          setModelStatus(progress);
        });
        setIsModelLoading(false);
        setModelStatus("Ready to analyze");
        toast.success("BERT model loaded successfully!");
      } catch (error) {
        console.error("Failed to load model:", error);
        setIsModelLoading(false);
        setModelStatus("Model loading failed - using fallback");
        toast.error("Failed to load ML model, using basic detection");
      }
    };

    loadModel();
  }, []);

  const analyzeComment = async () => {
    if (!inputText.trim()) {
      toast.error("Please enter text to analyze");
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Use the real BERT model for analysis
      const analysis = await analyzeToxicity(inputText);
      
      let filteredText = inputText;
      if (analysis.isToxic) {
        filteredText = filterToxicWords(inputText);
      }

      setResult({
        original: inputText,
        filtered: filteredText,
        isToxic: analysis.isToxic,
        toxicityScore: analysis.toxicityScore,
        categories: analysis.categories,
      });
      
      toast.success("Analysis complete!");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      analyzeComment();
    }
  };

  return (
    <section id="demo" className="py-24 px-4 bg-secondary/30">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Live Demo - Powered by BERT</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">
            Test the Filter
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Enter any comment below to see our transformer-based NLP model detect and filter toxic content in real-time
          </p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Comment Analysis</span>
              {isModelLoading && (
                <Badge variant="outline" className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading Model
                </Badge>
              )}
              {!isModelLoading && (
                <Badge variant="outline" className="text-accent border-accent">
                  Model Ready
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {modelStatus}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={isModelLoading 
                ? "You can start typing while the model loads..." 
                : "Type any comment or text to analyze for toxicity... (Press Ctrl/Cmd + Enter to analyze)"}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              className="min-h-[140px] resize-none"
            />

            <Button 
              onClick={analyzeComment} 
              disabled={isAnalyzing || isModelLoading || !inputText.trim()}
              className="w-full"
              size="lg"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing with BERT...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Analyze Comment
                </>
              )}
            </Button>

            {result && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border">
                  {result.isToxic ? (
                    <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium mb-1">
                      {result.isToxic ? "Toxic Content Detected" : "Content is Clean"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Toxicity Score: {(result.toxicityScore * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.categories.map((category) => (
                      <Badge
                        key={category}
                        variant={category === "Clean" ? "outline" : "destructive"}
                        className="text-xs"
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>

                {result.isToxic && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Filtered Output:</div>
                    <div className="p-4 rounded-lg bg-card border border-border">
                      <p className="text-foreground">{result.filtered}</p>
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground text-center pt-2">
                  Powered by BERT (Bidirectional Encoder Representations from Transformers)
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
