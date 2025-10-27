# Quick Start Guide

## What This Program Does

This TypeScript program fetches transcripts (captions/subtitles) from YouTube videos. It's useful for:
- Getting text versions of video content
- Searching for specific content in videos
- Analyzing video content
- Creating documentation from video tutorials

## Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

## Setup Steps

1. **Navigate to the project folder**
   ```bash
   cd youtube-transcript-fetcher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the program**
   ```bash
   npm run dev "YOUR_YOUTUBE_URL"
   ```

## Example Commands

```bash
# Basic usage with a YouTube URL
npm run dev "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Using a short URL
npm run dev "https://youtu.be/dQw4w9WgXcQ"

# Using just the video ID
npm run dev "dQw4w9WgXcQ"

# Run the advanced example (with file saving features)
npx ts-node src/advanced-example.ts
```

## Understanding the Code

### Key Concepts for Beginners

1. **TypeScript**: A typed version of JavaScript that helps catch errors before running code
2. **async/await**: A way to handle asynchronous operations (like fetching data from the internet)
3. **Interfaces**: Define the structure of data objects
4. **npm packages**: Reusable code libraries (we use `youtube-transcript`)

### Main Functions

- `extractVideoId()`: Extracts the video ID from different URL formats
- `fetchTranscript()`: Gets the transcript from YouTube
- `formatTranscript()`: Converts transcript data to plain text
- `formatTranscriptWithTimestamps()`: Adds timestamps to each line

## Files Explained

- `package.json`: Lists project dependencies and scripts
- `tsconfig.json`: TypeScript compiler configuration
- `src/index.ts`: Main program file
- `src/advanced-example.ts`: Advanced features (save to files, search, etc.)
- `README.md`: Detailed documentation

## Common Issues

**"No transcript available"**
- The video doesn't have captions/subtitles enabled
- Try a different video

**"Invalid YouTube URL"**
- Make sure you're using a valid YouTube URL format
- The video ID should be 11 characters

**TypeScript errors**
- Make sure you ran `npm install`
- Check that you have Node.js v16+ installed

## Next Steps

After getting the basic program working, try:
1. Modifying the code to save transcripts to files
2. Adding search functionality
3. Processing multiple videos
4. Integrating with other APIs

Check out `src/advanced-example.ts` for more features!
