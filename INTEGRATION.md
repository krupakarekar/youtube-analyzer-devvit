# YouTube Content Analyzer - Backend Integration

## 🎯 Overview

This document explains how the frontend React UI connects to the Python backend for YouTube content analysis.

## 🏗 Architecture

```
Frontend (React) → Node.js Server → Python Script → OpenAI API
     ↓                ↓              ↓              ↓
  YouTube URL    →  /analyze    →  youtube-analyzer.py → GPT-4 Analysis
```

## 📁 File Structure

```
yt-analyzer/
├── src/
│   ├── client/
│   │   └── App.tsx              # React UI with YouTube input
│   ├── server/
│   │   ├── index.ts             # Node.js server with /analyze endpoint
│   │   └── youtube-analyzer.py  # Python script for analysis
│   └── shared/
│       └── types/
│           └── api.ts           # TypeScript interfaces
├── requirements.txt             # Python dependencies
├── setup-python.sh             # Python setup script
└── env.template                # Environment variables template
```

## 🔧 Setup Instructions

### 1. Install Python Dependencies

```bash
# Run the setup script
./setup-python.sh

# Or manually install
pip3 install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
# Copy the template
cp env.template .env

# Edit .env with your OpenAI API key
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
```

### 3. Test the Python Script

```bash
# Test with a YouTube video ID
python3 src/server/youtube-analyzer.py dQw4w9WgXcQ
```

### 4. Run the Development Server

```bash
npm run dev
```

## 🔄 Integration Flow

### Frontend → Backend

1. **User Input**: User enters YouTube URL in React UI
2. **URL Validation**: Frontend extracts video ID from URL
3. **API Call**: Frontend sends POST request to `/analyze` endpoint
4. **Python Execution**: Node.js server spawns Python script
5. **Analysis**: Python script fetches transcript and analyzes with OpenAI
6. **Response**: Results returned to frontend as JSON

### API Endpoint

```typescript
POST /analyze
Content-Type: application/json

{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "videoId": "dQw4w9WgXcQ"
}
```

### Response Format

```typescript
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Video Title",
  "channelName": "Channel Name",
  "publishDate": "2024-01-01T00:00:00Z",
  "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "toxicityScore": 7,
  "biasTags": ["Political", "Cultural"],
  "emotions": {
    "anger": 0.8,
    "joy": 0.2,
    "trust": 0.3,
    "fear": 0.1,
    "sadness": 0.4,
    "surprise": 0.6,
    "disgust": 0.7
  }
}
```

## 🐍 Python Script Details

### Dependencies
- `openai`: For GPT-4 content analysis
- `youtube-transcript-api`: For fetching YouTube transcripts
- `python-dotenv`: For environment variable management

### Key Functions

1. **`get_transcript(video_id)`**: Fetches YouTube transcript
2. **`analyze_content_with_openai(transcript_text, video_id)`**: Analyzes content with GPT-4
3. **`analyze_youtube_video(video_id)`**: Main orchestration function

### OpenAI Prompt

The script uses a structured prompt to get consistent JSON responses:

```python
prompt = f"""Analyze the following YouTube video transcript and provide a structured JSON response:

Transcript: {transcript_text[:3000]}

Please provide a JSON response with the following structure:
{{
    "toxicityScore": <number 0-10>,
    "biasTags": ["<bias_type1>", "<bias_type2>", ...],
    "emotions": {{
        "anger": <number 0-1>,
        "joy": <number 0-1>,
        "trust": <number 0-1>,
        "fear": <number 0-1>,
        "sadness": <number 0-1>,
        "surprise": <number 0-1>,
        "disgust": <number 0-1>
    }}
}}"""
```

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run deploy
```

## 🔍 Troubleshooting

### Common Issues

1. **Python not found**: Ensure Python 3 is installed and in PATH
2. **OpenAI API key missing**: Check .env file has correct API key
3. **Transcript not available**: Some videos don't have transcripts
4. **Analysis timeout**: Large transcripts may take longer to process

### Debug Mode

Enable debug logging by setting environment variables:

```bash
DEBUG=1 npm run dev
```

## 📊 Performance Considerations

- **Transcript Limit**: Limited to first 3000 characters for OpenAI analysis
- **Timeout**: 60-second timeout for Python script execution
- **Rate Limits**: OpenAI API has rate limits for GPT-4 requests
- **Caching**: Consider implementing Redis caching for repeated analyses

## 🔒 Security

- API keys stored in environment variables
- Input validation on both frontend and backend
- Error handling prevents sensitive information leakage
- Timeout protection against long-running processes

## 🎯 Next Steps

1. **Enhanced Video Metadata**: Integrate YouTube Data API for better video info
2. **Caching**: Add Redis caching for analysis results
3. **Batch Processing**: Support for analyzing multiple videos
4. **Real-time Updates**: WebSocket support for live analysis progress
5. **Analytics**: Track analysis patterns and user behavior
