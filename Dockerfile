FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

CMD ["python", "render_start.py"]
