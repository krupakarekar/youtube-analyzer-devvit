# YouTube Transcript Fetcher

A TypeScript program to fetch transcripts from YouTube videos.

## Features

- Fetch transcripts from any YouTube video (that has captions available)
- Support for multiple URL formats (standard YouTube URLs, youtu.be links, or video IDs)
- Format transcripts as plain text or with timestamps
- Error handling and validation

## Installation

```bash
npm install
```

## Usage

### Run with ts-node (development)

```bash
npm run dev "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Build and run

```bash
npm run build
npm start "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Examples

```bash
# Using full YouTube URL
npm run dev "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Using short URL
npm run dev "https://youtu.be/dQw4w9WgXcQ"

# Using video ID directly
npm run dev "dQw4w9WgXcQ"
```

## How It Works

The program uses the `youtube-transcript` library, which:
1. Extracts the video ID from the URL
2. Fetches the transcript data from YouTube's API
3. Returns an array of transcript segments with text, timing, and duration

## Code Structure

- `extractVideoId()` - Parses different YouTube URL formats to extract the video ID
- `fetchTranscript()` - Fetches the raw transcript data
- `formatTranscript()` - Converts transcript to plain text
- `formatTranscriptWithTimestamps()` - Adds timestamps to each line

## Notes

- The video must have captions/subtitles available (auto-generated or manual)
- Some videos may have disabled transcripts
- The library fetches official YouTube captions, not third-party sources

## Extending the Program

You can extend this program to:
- Save transcripts to files
- Search for specific words or phrases
- Translate transcripts
- Generate summaries
- Export to different formats (JSON, SRT, etc.)
