import { fetchTranscript as fetchYoutubeTranscript } from '@egoist/youtube-transcript-plus';

/**
 * Interface for transcript items returned from YouTube
 */
interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

/**
 * Decodes HTML entities in a string (including double-encoded entities)
 * @param text - Text containing HTML entities
 * @returns Decoded text
 */
function decodeHTMLEntities(text: string): string {
  const namedEntities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  // Decode twice to handle double-encoded entities like &amp;#39;
  let decoded = text;
  for (let i = 0; i < 2; i++) {
    decoded = decoded
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&[a-z]+;/gi, (entity) => namedEntities[entity.toLowerCase()] || entity);
  }

  return decoded;
}

/**
 * Extracts the video ID from various YouTube URL formats
 * @param url - YouTube video URL
 * @returns Video ID or null if invalid
 */
function extractVideoId(url: string): string | null {
  // Regular YouTube URL: https://www.youtube.com/watch?v=VIDEO_ID
  const standardMatch = url.match(/[?&]v=([^&]+)/);
  if (standardMatch) return standardMatch[1];
  
  // Short URL: https://youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];
  
  // If it's already just a video ID
  if (url.length === 11 && !url.includes('/')) return url;
  
  return null;
}

/**
 * Fetches the transcript for a YouTube video
 * @param videoUrl - YouTube video URL or video ID
 * @returns Array of transcript items
 */
async function fetchTranscript(videoUrl: string): Promise<TranscriptItem[]> {
  try {
    const videoId = extractVideoId(videoUrl);

    if (!videoId) {
      throw new Error('Invalid YouTube URL or video ID');
    }

    console.log(`Fetching transcript for video ID: ${videoId}`);

    // Fetch the transcript
    const response = await fetchYoutubeTranscript(videoId);

    // Check if transcript is empty or undefined
    if (!response || !response.segments || response.segments.length === 0) {
      throw new Error('No transcript found. This video may not have captions available.');
    }

    // Map the response segments to our TranscriptItem interface and decode HTML entities
    return response.segments.map(segment => ({
      text: decodeHTMLEntities(segment.text),
      duration: segment.duration,
      offset: segment.offset
    }));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nError details: ${error.message}`);
      throw error; // Re-throw the original error instead of wrapping it
    }
    throw new Error('Failed to fetch transcript: Unknown error');
  }
}

/**
 * Formats the transcript into readable text
 * @param transcript - Array of transcript items
 * @returns Formatted transcript string
 */
function formatTranscript(transcript: TranscriptItem[]): string {
  return transcript.map(item => item.text).join(' ');
}

/**
 * Formats the transcript with timestamps
 * @param transcript - Array of transcript items
 * @returns Formatted transcript with timestamps
 */
function formatTranscriptWithTimestamps(transcript: TranscriptItem[]): string {
  return transcript
    .map(item => {
      const minutes = Math.floor(item.offset / 60000);
      const seconds = Math.floor((item.offset % 60000) / 1000);
      const timestamp = `[${minutes}:${seconds.toString().padStart(2, '0')}]`;
      return `${timestamp} ${item.text}`;
    })
    .join('\n');
}

/**
 * Main function to demonstrate usage
 */
async function main() {
  // Example usage - replace with your YouTube video URL
  const videoUrl = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  
  try {
    console.log('YouTube Transcript Fetcher\n');
    
    const transcript = await fetchTranscript(videoUrl);
    
    console.log(`\nFetched ${transcript.length} transcript items\n`);
    
    // Option 1: Plain text transcript
    console.log('=== Plain Text Transcript ===');
    const plainText = formatTranscript(transcript);
    console.log(plainText.substring(0, 500) + '...\n');
    
    // Option 2: Transcript with timestamps
    console.log('=== Transcript with Timestamps (first 10 items) ===');
    const withTimestamps = formatTranscriptWithTimestamps(transcript.slice(0, 10));
    console.log(withTimestamps);
    
    // You can also save to a file or process further
    console.log('\n✓ Transcript fetched successfully!');
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('An unknown error occurred');
    }
    process.exit(1);
  }
}

// Run the main function
main();
