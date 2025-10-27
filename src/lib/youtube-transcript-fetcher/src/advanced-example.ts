import { fetchTranscript as fetchYoutubeTranscript } from '@egoist/youtube-transcript-plus';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Advanced example showing different ways to use the transcript fetcher
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

class TranscriptFetcher {
  /**
   * Fetch transcript for a video
   */
  async fetchTranscript(videoId: string): Promise<TranscriptItem[]> {
    try {
      const response = await fetchYoutubeTranscript(videoId);

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
      throw new Error(`Failed to fetch transcript: ${error}`);
    }
  }

  /**
   * Save transcript to a text file
   */
  saveToFile(transcript: TranscriptItem[], filename: string): void {
    const text = transcript.map(item => item.text).join(' ');
    fs.writeFileSync(filename, text, 'utf-8');
    console.log(`Saved to ${filename}`);
  }

  /**
   * Save transcript with timestamps to file
   */
  saveWithTimestamps(transcript: TranscriptItem[], filename: string): void {
    const formatted = transcript
      .map(item => {
        const minutes = Math.floor(item.offset / 60000);
        const seconds = Math.floor((item.offset % 60000) / 1000);
        const timestamp = `[${minutes}:${seconds.toString().padStart(2, '0')}]`;
        return `${timestamp} ${item.text}`;
      })
      .join('\n');
    
    fs.writeFileSync(filename, formatted, 'utf-8');
    console.log(`Saved with timestamps to ${filename}`);
  }

  /**
   * Save transcript as JSON
   */
  saveAsJson(transcript: TranscriptItem[], filename: string): void {
    fs.writeFileSync(filename, JSON.stringify(transcript, null, 2), 'utf-8');
    console.log(`Saved as JSON to ${filename}`);
  }

  /**
   * Search for a phrase in the transcript
   */
  searchTranscript(transcript: TranscriptItem[], searchTerm: string): TranscriptItem[] {
    return transcript.filter(item => 
      item.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  /**
   * Get transcript segment by time range (in seconds)
   */
  getTimeSegment(
    transcript: TranscriptItem[], 
    startSeconds: number, 
    endSeconds: number
  ): TranscriptItem[] {
    const startMs = startSeconds * 1000;
    const endMs = endSeconds * 1000;
    
    return transcript.filter(item => 
      item.offset >= startMs && item.offset <= endMs
    );
  }

  /**
   * Get statistics about the transcript
   */
  getStats(transcript: TranscriptItem[]): {
    totalSegments: number;
    totalDuration: string;
    wordCount: number;
    avgWordsPerSegment: number;
  } {
    const totalMs = transcript[transcript.length - 1]?.offset || 0;
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    
    const allText = transcript.map(item => item.text).join(' ');
    const wordCount = allText.split(/\s+/).length;
    
    return {
      totalSegments: transcript.length,
      totalDuration: `${minutes}:${seconds.toString().padStart(2, '0')}`,
      wordCount: wordCount,
      avgWordsPerSegment: Math.round(wordCount / transcript.length)
    };
  }
}

// Example usage
async function exampleUsage() {
  const fetcher = new TranscriptFetcher();
  const videoId = 'dQw4w9WgXcQ'; // Replace with your video ID
  
  try {
    console.log('Fetching transcript...\n');
    const transcript = await fetcher.fetchTranscript(videoId);
    
    // Get statistics
    const stats = fetcher.getStats(transcript);
    console.log('Transcript Statistics:');
    console.log(`- Total segments: ${stats.totalSegments}`);
    console.log(`- Duration: ${stats.totalDuration}`);
    console.log(`- Word count: ${stats.wordCount}`);
    console.log(`- Avg words per segment: ${stats.avgWordsPerSegment}\n`);
    
    // Search for a phrase
    const searchResults = fetcher.searchTranscript(transcript, 'never');
    console.log(`Found "${searchResults.length}" segments containing "never"\n`);
    
    // Get a time segment (e.g., first 30 seconds)
    const segment = fetcher.getTimeSegment(transcript, 0, 30);
    console.log(`First 30 seconds has ${segment.length} segments\n`);
    
    // Save in different formats
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    fetcher.saveToFile(transcript, path.join(outputDir, 'transcript.txt'));
    fetcher.saveWithTimestamps(transcript, path.join(outputDir, 'transcript_timestamps.txt'));
    fetcher.saveAsJson(transcript, path.join(outputDir, 'transcript.json'));
    
    console.log('\n✓ All operations completed!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  exampleUsage();
}

export { TranscriptFetcher };
