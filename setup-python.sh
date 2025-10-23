#!/bin/bash

# Setup script for Python dependencies
echo "🐍 Setting up Python dependencies for YouTube Analyzer..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip is not installed. Please install pip first."
    exit 1
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Make the Python script executable
chmod +x src/server/youtube-analyzer.py

echo "✅ Python setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Create a .env file in the project root with your OpenAI API key:"
echo "   OPENAI_API_KEY=sk-proj-your-key-here"
echo "2. Test the Python script:"
echo "   python3 src/server/youtube-analyzer.py dQw4w9WgXcQ"
echo "3. Run the development server:"
echo "   npm run dev"
