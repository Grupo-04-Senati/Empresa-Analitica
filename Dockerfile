FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data with error handling
RUN python -c "import nltk; nltk.download('punkt', quiet=True)" || true
RUN python -c "import nltk; nltk.download('punkt_tab', quiet=True)" || true
RUN python -c "import nltk; nltk.download('stopwords', quiet=True)" || true
RUN python -c "import nltk; nltk.download('wordnet', quiet=True)" || true
RUN python -c "import nltk; nltk.download('movie_reviews', quiet=True)" || true
RUN python -c "import nltk; nltk.download('vader_lexicon', quiet=True)" || true

COPY backend/ .

EXPOSE 8000

CMD ["python", "render_start.py"]
