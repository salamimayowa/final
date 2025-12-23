package com.toxicfilter.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AnalysisRequest {
    
    @NotBlank(message = "Text cannot be empty")
    @Size(max = 5000, message = "Text cannot exceed 5000 characters")
    private String text;
}
