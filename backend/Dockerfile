FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install WeasyPrint system dependencies (GTK/Pango stack for PDF rendering)
# Install FFmpeg for video processing (MoviePy requires FFmpeg for encoding/decoding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgobject-2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    libreoffice \
    libreoffice-core \
    fonts-opensymbol \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade uv pip && \
    uv pip sync --torch-backend=cpu --system requirements.txt

# Copy project
COPY . /app/

# Collect static files
RUN python manage.py collectstatic --noinput

# Run migrations, seed personas, and start server with Gunicorn
CMD ["sh", "-c", "python manage.py migrate && python manage.py collectstatic --noinput && gunicorn aiworks_sample.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 1000"]
