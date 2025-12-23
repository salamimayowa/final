# Toxic Comment Filter - Java Spring Boot Backend

Backend API for toxic comment detection using BERT transformers and NLP.

## Prerequisites

- Java 17 or higher
- Maven 3.6+
- 4GB+ RAM (for BERT model)

## Setup

1. Navigate to the backend-java directory:
```bash
cd backend-java
```

2. Build the project:
```bash
mvn clean install
```

3. Run the application:
```bash
mvn spring-boot:run
```

The API will start on `http://localhost:8080`

## API Endpoints

### Analyze Text
**POST** `/api/toxicity/analyze`

Request:
```json
{
  "text": "Your text to analyze"
}
```

Response:
```json
{
  "isToxic": true,
  "toxicityScore": 0.87,
  "categories": ["Insult", "Toxic"],
  "filteredText": "You are an ████",
  "processingTimeMs": 245
}
```

### Health Check
**GET** `/api/toxicity/health`

Response:
```json
{
  "status": "UP",
  "service": "Toxic Comment Filter API"
}
```

## Integration with Frontend

Update your frontend's DemoSection.tsx to call this backend:

```typescript
const API_URL = "http://localhost:8080/api/toxicity";

const analyzeWithBackend = async (text: string) => {
  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return response.json();
};
```

## Model Information

- Uses `unitary/toxic-bert` model via Deep Java Library (DJL)
- Detects 6 toxicity categories
- Context-aware analysis using BERT transformers
- Average processing time: 200-300ms per text

## Production Deployment

For production, consider:
- Enabling HTTPS
- Adding authentication
- Implementing rate limiting
- Configuring CORS properly
- Using a production-ready model hosting solution
