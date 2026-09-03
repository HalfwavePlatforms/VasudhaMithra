FROM python:3.11-slim

# Tesseract + Indic language packs, plus OpenCV's runtime deps
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-hin tesseract-ocr-kan tesseract-ocr-mar tesseract-ocr-ben tesseract-ocr-tam tesseract-ocr-tel \
    libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ .

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
