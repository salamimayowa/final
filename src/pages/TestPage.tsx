import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const TestPage = () => {
  const toxicComments = [
    {
      username: "angry_user123",
      comment: "You're such an idiot, nobody cares about your stupid opinion!",
      platform: "Social Media"
    },
    {
      username: "troll_account",
      comment: "Go kill yourself, you worthless piece of garbage.",
      platform: "Forum"
    },
    {
      username: "hater99",
      comment: "I hope you die in a fire. You're the worst person ever.",
      platform: "Comments Section"
    },
    {
      username: "mean_person",
      comment: "You're so ugly and dumb. Everyone hates you.",
      platform: "Chat"
    },
    {
      username: "bully_online",
      comment: "Shut the hell up you moron! Nobody asked for your crap.",
      platform: "Gaming"
    },
    {
      username: "toxic_gamer",
      comment: "You suck at this game, uninstall and never play again loser!",
      platform: "Gaming"
    },
    {
      username: "rude_commenter",
      comment: "What a pathetic excuse for a human being. Disgusting.",
      platform: "News Article"
    },
    {
      username: "keyboard_warrior",
      comment: "I'll find you and make you regret ever posting this trash.",
      platform: "Social Media"
    }
  ];

  const safeComments = [
    {
      username: "friendly_user",
      comment: "Great post! I really enjoyed reading your perspective on this topic.",
      platform: "Blog"
    },
    {
      username: "helpful_person",
      comment: "Thanks for sharing this information, it was really helpful!",
      platform: "Forum"
    },
    {
      username: "positive_vibes",
      comment: "Keep up the amazing work! You're doing great.",
      platform: "Social Media"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <h1 className="text-3xl font-bold">Extension Test Page</h1>
          </div>
          
          <p className="text-muted-foreground max-w-2xl">
            This page contains sample toxic comments for testing the Toxic Comment Filter browser extension. 
            If your extension is working correctly, these comments should be detected and filtered.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Toxic Comments Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Toxic Comments (Should Be Filtered)
            </h2>
            <div className="space-y-4">
              {toxicComments.map((item, index) => (
                <Card key={index} className="border-destructive/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex justify-between">
                      <span className="font-medium">@{item.username}</span>
                      <span className="text-xs text-muted-foreground">{item.platform}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground">{item.comment}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Safe Comments Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-primary flex items-center gap-2">
              ✓ Safe Comments (Should NOT Be Filtered)
            </h2>
            <div className="space-y-4">
              {safeComments.map((item, index) => (
                <Card key={index} className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex justify-between">
                      <span className="font-medium">@{item.username}</span>
                      <span className="text-xs text-muted-foreground">{item.platform}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground">{item.comment}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Instructions */}
            <Card className="mt-8 bg-muted/50">
              <CardHeader>
                <CardTitle className="text-lg">How to Test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>1. Make sure the extension is installed and enabled</p>
                <p>2. Click the extension icon and ensure it's turned ON</p>
                <p>3. Refresh this page</p>
                <p>4. Toxic comments on the left should be blurred/filtered</p>
                <p>5. Safe comments on the right should remain visible</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPage;
