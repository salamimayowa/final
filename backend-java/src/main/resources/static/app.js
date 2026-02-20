// Simple client for the /api/toxicity/analyze endpoint
document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const inputText = document.getElementById('inputText');
  const resultEl = document.getElementById('result');
  const rawEl = document.getElementById('raw');
  const isToxicEl = document.getElementById('isToxic');
  const scoreEl = document.getElementById('score');
  const categoriesEl = document.getElementById('categories');
  const filteredEl = document.getElementById('filtered');
  const errorEl = document.getElementById('error');
  const sensitivity = document.getElementById('sensitivity');
  const sensitivityValue = document.getElementById('sensitivityValue');

  sensitivity.addEventListener('input', () => {
    sensitivityValue.textContent = sensitivity.value;
  });

  analyzeBtn.addEventListener('click', async () => {
    const text = inputText.value.trim();
    if (!text) return alert('Please enter text to analyze');

    resultEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    try {
      const resp = await fetch('/api/toxicity/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || 'Server error');
      }

      const data = await resp.json();
      rawEl.textContent = JSON.stringify(data, null, 2);
      isToxicEl.textContent = data.isToxic;
      scoreEl.textContent = data.toxicityScore;
      categoriesEl.textContent = (data.categories || []).join(', ');
      filteredEl.textContent = data.filteredText || '';
      resultEl.classList.remove('hidden');
    } catch (err) {
      errorEl.textContent = 'Analysis failed: ' + (err.message || err);
      errorEl.classList.remove('hidden');
    }
  });
});
