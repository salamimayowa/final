import { pipeline } from "@huggingface/transformers";

let classifierInstance: any = null;
let isLoading = false;

const toxicityCategories: { [key: string]: string[] } = {
  "toxic": ["Toxic", "General Toxicity"],
  "severe_toxic": ["Severe Toxicity", "Extreme Toxicity"],
  "obscene": ["Obscene", "Profanity"],
  "threat": ["Threat", "Threatening"],
  "insult": ["Insult", "Personal Attack"],
  "identity_hate": ["Identity Hate", "Hate Speech"],
};

export const initToxicityDetector = async (onProgress?: (progress: string) => void) => {
  if (classifierInstance) return classifierInstance;
  if (isLoading) {
    // Wait for the current loading to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return classifierInstance;
  }

  isLoading = true;
  try {
    onProgress?.("Loading BERT model...");
    
    // Use a smaller, faster model for toxicity detection
    classifierInstance = await pipeline(
      "text-classification",
      "Xenova/toxic-bert",
      { 
        device: "webgpu",
        // Fallback to WASM if WebGPU is not available
      }
    );
    
    onProgress?.("Model loaded successfully!");
    return classifierInstance;
  } catch (error) {
    console.error("Error loading model:", error);
    // Fallback to CPU/WASM if WebGPU fails
    try {
      onProgress?.("Loading model (CPU mode)...");
      classifierInstance = await pipeline(
        "text-classification",
        "Xenova/toxic-bert"
      );
      onProgress?.("Model loaded successfully!");
      return classifierInstance;
    } catch (fallbackError) {
      console.error("Fallback error:", fallbackError);
      throw new Error("Failed to load toxicity detection model");
    }
  } finally {
    isLoading = false;
  }
};

export const analyzeToxicity = async (text: string) => {
  if (!classifierInstance) {
    throw new Error("Model not initialized. Call initToxicityDetector first.");
  }

  try {
    const results = await classifierInstance(text, {
      topk: null, // Get all labels with their scores
    });

    // Process results
    const toxicLabels: string[] = [];
    let maxScore = 0;
    let isToxic = false;

    results.forEach((result: { label: string; score: number }) => {
      if (result.score > 0.5) {
        isToxic = true;
        const categoryNames = toxicityCategories[result.label.toLowerCase()] || [result.label];
        toxicLabels.push(...categoryNames);
        maxScore = Math.max(maxScore, result.score);
      }
    });

    return {
      isToxic,
      toxicityScore: maxScore,
      categories: toxicLabels.length > 0 ? Array.from(new Set(toxicLabels)) : ["Clean"],
    };
  } catch (error) {
    console.error("Error analyzing text:", error);
    throw error;
  }
};

export const filterToxicWords = (text: string): string => {
  // Common toxic words to filter (this is a simplified version)
  const toxicPatterns = [
    /\b(idiot|stupid|dumb|moron)\b/gi,
    /\b(hate|hated|hating)\b/gi,
    /\b(kill|die|death)\b/gi,
    /\b(garbage|trash|waste)\b/gi,
    /\b(ashamed|shame)\b/gi,
    /\b(fuck|shit|damn|hell|ass|bitch)\b/gi,
  ];

  let filtered = text;
  toxicPatterns.forEach(pattern => {
    filtered = filtered.replace(pattern, (match) => '█'.repeat(match.length));
  });

  return filtered;
};
