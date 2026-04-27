@echo off
echo Starting Pika Bot Local Server...
echo Make sure Ollama is running!
start http://localhost:8000
python -m http.server 8000