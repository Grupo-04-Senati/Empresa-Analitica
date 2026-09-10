FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab'); nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('movie_reviews'); nltk.download('vader_lexicon')"

COPY backend/ .

EXPOSE 8000

CMD ["python", "render_start.py"]
