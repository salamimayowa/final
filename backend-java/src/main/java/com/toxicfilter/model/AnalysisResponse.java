package com.toxicfilter.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisResponse {
    private boolean isToxic;
    private double toxicityScore;
    private List<String> categories;
    private String filteredText;
    private long processingTimeMs;
}
