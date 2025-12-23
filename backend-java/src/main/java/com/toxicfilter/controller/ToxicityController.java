package com.toxicfilter.controller;

import com.toxicfilter.model.AnalysisRequest;
import com.toxicfilter.model.AnalysisResponse;
import com.toxicfilter.service.ToxicityDetectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/toxicity")
@RequiredArgsConstructor
public class ToxicityController {
    
    private final ToxicityDetectionService toxicityDetectionService;
    
    @PostMapping("/analyze")
    public ResponseEntity<AnalysisResponse> analyzeText(@Valid @RequestBody AnalysisRequest request) {
        log.info("Analyzing text with length: {}", request.getText().length());
        
        AnalysisResponse response = toxicityDetectionService.analyzeToxicity(request.getText());
        
        log.info("Analysis complete - Toxic: {}, Score: {}", 
                response.isToxic(), response.getToxicityScore());
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "Toxic Comment Filter API"
        ));
    }
}
