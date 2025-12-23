package com.toxicfilter.service;

import java.io.IOException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.toxicfilter.model.AnalysisResponse;

import ai.djl.MalformedModelException;
import ai.djl.inference.Predictor;
import ai.djl.modality.Classifications;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ModelNotFoundException;
import ai.djl.repository.zoo.ZooModel;
import ai.djl.training.util.ProgressBar;
import ai.djl.translate.TranslateException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class ToxicityDetectionService {
    
    private ZooModel<String, Classifications> model;

    // Toxicity categories mapping for BERT labels
    private static final Map<String, List<String>> TOXICITY_CATEGORIES = Map.of(
        "toxic", List.of("Toxic", "General Toxicity"),
        "severe_toxic", List.of("Severe Toxicity", "Extreme Toxicity"),
        "obscene", List.of("Obscene", "Profanity"),
        "threat", List.of("Threat", "Threatening"),
        "insult", List.of("Insult", "Personal Attack"),
        "identity_hate", List.of("Identity Hate", "Hate Speech")
    );

    // Patterns for manual word filtering (Regex)
    private static final List<Pattern> TOXIC_PATTERNS = List.of(
        Pattern.compile("\\b(idiot|stupid|dumb|moron)\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\b(fuck|shit|damn|bitch|asshole)\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\b(kill|die|death)\\b", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\b(hate)\\b", Pattern.CASE_INSENSITIVE)
    );

    @PostConstruct
    public void initialize() throws ModelNotFoundException, MalformedModelException, IOException {
        log.info("Initializing BERT toxicity detection model...");
        
        Criteria<String, Classifications> criteria = Criteria.builder()
            .setTypes(String.class, Classifications.class)
            .optModelUrls("djl://ai.djl.huggingface.pytorch/unitary/toxic-bert")
            .optEngine("PyTorch")
            .optArgument("tokenizer", "bert-base-uncased") 
            .optProgress(new ProgressBar())
            .build();
        
        model = criteria.loadModel();
        log.info("Model initialized successfully");
    }
    
    public AnalysisResponse analyzeToxicity(String text) {
        long startTime = System.currentTimeMillis();
        
        try (Predictor<String, Classifications> predictor = model.newPredictor()) {
            Classifications classifications = predictor.predict(text);
            
            List<String> toxicCategories = new ArrayList<>();
            double maxScore = 0.0;
            boolean isToxic = false;
            
            for (Classifications.Classification classification : classifications.items()) {
                double score = classification.getProbability();
                String label = classification.getClassName().toLowerCase();
                
                if (score > 0.5) {
                    isToxic = true;
                    maxScore = Math.max(maxScore, score);
                    toxicCategories.addAll(TOXICITY_CATEGORIES.getOrDefault(label, List.of(label)));
                }
            }

            // If no categories were flagged by AI, but it's "Clean"
            if (toxicCategories.isEmpty()) {
                toxicCategories.add("Clean");
            }

            return AnalysisResponse.builder()
                .isToxic(isToxic)
                .toxicityScore(maxScore)
                .categories(new ArrayList<>(new HashSet<>(toxicCategories)))
                .filteredText(filterToxicWords(text)) // Calling the implementation below
                .processingTimeMs(System.currentTimeMillis() - startTime)
                .build();
                
        } catch (TranslateException e) {
            log.error("Translation error during prediction", e);
            throw new RuntimeException("Model failed to process text", e);
        }
    }

    /**
     * Implemented: Scans text for specific toxic patterns and replaces them with █
     */
    private String filterToxicWords(String text) {
        if (text == null) return null;
        String filtered = text;
        
        for (Pattern pattern : TOXIC_PATTERNS) {
            Matcher matcher = pattern.matcher(filtered);
            StringBuilder sb = new StringBuilder();
            int lastEnd = 0;
            while (matcher.find()) {
                sb.append(filtered, lastEnd, matcher.start());
                // Replace word with █ characters of the same length
                sb.append("█".repeat(matcher.group().length()));
                lastEnd = matcher.end();
            }
            sb.append(filtered.substring(lastEnd));
            filtered = sb.toString();
        }
        
        return filtered;
    }
}