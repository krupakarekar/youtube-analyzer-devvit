import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse, YouTubeAnalysisResult } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort, settings } from '@devvit/web/server';
import { createPost } from './core/post';
import { fetchTranscript } from '@egoist/youtube-transcript-plus';

console.log('✅ Server starting - fetchTranscript imported:', typeof fetchTranscript);

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// YouTube Analysis Endpoint with Transcript Support
router.post<unknown, YouTubeAnalysisResult | { error: string; message: string }, { url: string; videoId: string }>(
  '/api/analyze',
  async (req, res): Promise<void> => {
    // Set a longer timeout for this endpoint (60 seconds)
    req.setTimeout(60000);
    res.setTimeout(60000);

    // Send keep-alive headers to prevent connection timeout
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=60');

    try {
      const { videoId } = req.body;

      if (!videoId) {
        res.status(400).json({
          error: 'INVALID_VIDEO_ID',
          message: 'Video ID is required',
        });
        return;
      }

      console.log(`Starting YouTube analysis for video ID: ${videoId}`);

      // Use metadata-based analysis as primary method (transcript fetching often hits rate limits)
      const analysisResult = await analyzeVideoWithMetadata(videoId);

      if ('error' in analysisResult) {
        res.status(500).json({
          error: 'ANALYSIS_FAILED',
          message: analysisResult.error,
        });
        return;
      }

      console.log(`Analysis completed for video ${videoId}`);
      res.json(analysisResult);

    } catch (error) {
      console.error('YouTube analysis error:', error);
      
      // Make sure we haven't already sent a response
      if (!res.headersSent) {
        res.status(500).json({
          error: 'ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }
  }
);

// Helper function to combine transcript entries into full text
interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

function getFullTranscriptText(transcript: TranscriptItem[]): string {
  return transcript
    .map(entry => entry.text)
    .join(' ')
    .trim();
}

// Primary analysis function using video metadata (avoids rate limits from transcript scraping)
async function analyzeVideoWithMetadata(videoId: string): Promise<YouTubeAnalysisResult | { error: string }> {
  console.log('🚀 ===== STARTING METADATA-BASED ANALYSIS =====');
  console.log(`🎥 Video ID: ${videoId}`);

  try {
    console.log('📋 Fetching video metadata from YouTube API...');
    const videoInfo = await getYouTubeVideoInfo(videoId);
    console.log('✅ Video metadata fetched successfully');
    console.log(`   Title: ${videoInfo.title}`);
    console.log(`   Channel: ${videoInfo.channelName}`);
    console.log(`   Description length: ${videoInfo.description?.length || 0} characters`);

    console.log('🔍 Analyzing video content with OpenAI...');
    const analysisResult = await analyzeVideoContent(videoId, videoInfo);
    console.log('✅ Analysis completed successfully');
    console.log('📊 Analysis result:', JSON.stringify(analysisResult, null, 2).substring(0, 500));

    return analysisResult;
  } catch (error) {
    console.error('❌ Metadata analysis failed:');
    console.error('   Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('   Error message:', error instanceof Error ? error.message : String(error));
    console.error('   Full error:', error);
    console.error('   Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred during analysis'
    };
  }
}

// Optional: Transcript-based analysis (currently disabled due to rate limits)
// This function is kept for future use if rate limiting issues are resolved
async function analyzeVideoWithTranscript(videoId: string): Promise<YouTubeAnalysisResult | { error: string }> {
  console.log('🚀 ===== STARTING analyzeVideoWithTranscript =====');
  console.log(`🎥 Video ID: ${videoId}`);
  console.log(`🔍 fetchTranscript available: ${typeof fetchTranscript}`);
  try {
    console.log('='.repeat(80));

    // Fetch transcript using JavaScript package with retry logic
    console.log('\n📥 Fetching transcript...');
    console.log(`🔍 Video ID being used: "${videoId}"`);
    console.log(`🔍 Video URL would be: https://www.youtube.com/watch?v=${videoId}`);
    let transcript;

    // Try to fetch transcript with retry logic (max 3 attempts)
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🌐 Attempt ${attempt}/${maxRetries}: Calling fetchTranscript()...`);

        // Add delay between retries (exponential backoff)
        if (attempt > 1) {
          const delayMs = Math.pow(2, attempt - 1) * 1000; // 2s, 4s, 8s...
          console.log(`⏳ Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        const response: any = await fetchTranscript(videoId);
        console.log(`✅ fetchTranscript() returned successfully on attempt ${attempt}`);
        console.log(`🔍 Response type: ${Array.isArray(response) ? 'Array' : typeof response}`);
        console.log(`🔍 Response structure:`, JSON.stringify(response, null, 2).substring(0, 500));

        // The library may return an array of segments OR an object with a `segments` array
        const segments: Array<{ text: string; duration?: number; offset?: number; start?: number }> =
          Array.isArray(response) ? response : response?.segments;

        console.log(`🔍 Segments extracted: ${segments ? `${segments.length} items` : 'null/undefined'}`);

        if (!segments || segments.length === 0) {
          console.log('⚠️ No transcript available for this video (empty response)');
          console.log('⚠️ Response was:', JSON.stringify(response));
          console.log('⚠️ Falling back to metadata analysis...');
          return await analyzeVideoWithMetadata(videoId);
        }

        // Normalize segment fields to our TranscriptItem interface
        transcript = segments.map((segment) => ({
          text: segment.text,
          duration: typeof segment.duration === 'number' ? segment.duration : 0,
          offset: typeof segment.offset === 'number' ? segment.offset : (typeof segment.start === 'number' ? segment.start : 0),
        }));

        console.log('✅ Transcript fetch successful');
        console.log(`✅ Transcript retrieved: ${transcript.length} entries`);
        console.log(`✅ First segment text: "${transcript[0]?.text}"`);

        // Success! Break out of retry loop
        break;

      } catch (transcriptError) {
        lastError = transcriptError;
        const errorMsg = transcriptError instanceof Error ? transcriptError.message : String(transcriptError);

        // Check if it's a rate limit error (429)
        const isRateLimit = errorMsg.includes('429') || errorMsg.includes('Too Many Requests');

        console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`);
        console.error('❌ Error type:', transcriptError instanceof Error ? transcriptError.constructor.name : typeof transcriptError);
        console.error('❌ Error message:', errorMsg);
        console.error('❌ Is rate limit error:', isRateLimit);

        // If it's the last attempt or not a rate limit error, give up
        if (attempt === maxRetries || !isRateLimit) {
          console.error('❌ All retry attempts exhausted or non-retryable error');
          console.error('❌ Full error object:', transcriptError);
          console.log('⚠️ Falling back to metadata analysis...');
          return await analyzeVideoWithMetadata(videoId);
        }

        console.log(`⚠️ Rate limit detected, will retry (attempt ${attempt + 1}/${maxRetries})...`);
      }
    }

    // Show first few entries
    console.log('\n📜 First 10 entries of transcript:');
    console.log('-'.repeat(80));
    transcript.slice(0, 10).forEach((entry: any) => {
      console.log(`[${entry.offset}s] ${entry.text}`);
    });

    // Get full transcript text
    const fullText = getFullTranscriptText(transcript);
    console.log(`\n📊 Total transcript length: ${fullText.length} characters`);

    // Limit transcript length to avoid long processing times (max 3000 chars)
    const limitedText = fullText.substring(0, 3000);
    if (fullText.length > 3000) {
      console.log(`⚠️ Transcript truncated from ${fullText.length} to 3000 characters`);
    }

    // Analyze content with OpenAI
    console.log('\n🔍 Analyzing content with AI...');
    console.log('='.repeat(80));
    console.log(`📊 Sending ${limitedText.length} characters to OpenAI...`);

    let analysis;
    try {
      analysis = await analyzeContent(limitedText);
      console.log('✅ OpenAI analysis successful');
      console.log(`✅ Analysis result length: ${analysis.length} characters`);
    } catch (analysisError) {
      console.error('❌ OpenAI analysis failed:');
      console.error('❌ Error type:', analysisError instanceof Error ? analysisError.constructor.name : typeof analysisError);
      console.error('❌ Error message:', analysisError instanceof Error ? analysisError.message : String(analysisError));
      console.error('❌ Full error:', analysisError);
      throw new Error(`OpenAI analysis failed: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`);
    }

    console.log('\n🤖 AI ANALYSIS RESULTS:');
    console.log('='.repeat(80));
    console.log(analysis);
    console.log('='.repeat(80));

    // Parse analysis and return structured result
    return await parseAnalysisResult(analysis, videoId);

  } catch (error) {
    console.error('Error in analyzeVideoWithTranscript:', error);
    // Return error object
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}


// OpenAI analysis function (converted from Python)
async function analyzeContent(transcriptText: string): Promise<string> {
  // Access API key from Devvit settings
  const openaiApiKey = await settings.get<string>('openaiApiKey');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured. Set it using: npx devvit settings set openaiApiKey');
  }

  const prompt = `Analyze the following YouTube video transcript for:

1. **Toxicity**: Check for hate speech, harassment, profanity, threats, or harmful content
2. **Bias**: Identify any political, cultural, gender, racial, or ideological biases
3. **Misinformation**: Look for false claims, misleading statements, or unverified facts

Transcript (first ~3000 characters):
${transcriptText}

Please provide a brief analysis with:
- Toxicity score (0-10, where 10 is highly toxic)
- Bias types detected (if any)
- Key concerns (if any)

Keep the response concise.`;

  try {
    // Create an AbortController with a 15 second timeout (reduced for faster response)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',  // Changed from gpt-4 for much faster responses
        messages: [
          {
            role: 'system',
            content: 'You are an expert content moderator analyzing video transcripts for toxicity, bias, and misinformation. Be objective and provide a concise analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 400  // Reduced further to speed up response
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI request timed out after 15 seconds');
    }
    throw new Error(`Error analyzing content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Parse analysis result into structured JSON (converted from Python)
async function parseAnalysisResult(analysis: string, videoId: string): Promise<YouTubeAnalysisResult> {
  try {
    // Fetch video metadata
    console.log('📋 Fetching video metadata...');
    const videoInfo = await getYouTubeVideoInfo(videoId);

    // Extract toxicity score from analysis text
    let toxicityScore = 5; // Default score
    if (analysis.toLowerCase().includes('toxicity score')) {
      const scoreMatch = analysis.match(/(\d+)/);
      if (scoreMatch && scoreMatch[1]) {
        toxicityScore = parseInt(scoreMatch[1]);
      }
    }

    // Extract bias tags
    const biasTags: string[] = [];
    const analysisLower = analysis.toLowerCase();
    if (analysisLower.includes('bias')) {
      if (analysisLower.includes('political')) biasTags.push('Political');
      if (analysisLower.includes('cultural')) biasTags.push('Cultural');
      if (analysisLower.includes('gender')) biasTags.push('Gender');
      if (analysisLower.includes('racial')) biasTags.push('Racial');
    }

    // Create structured result with real video metadata
    return {
      videoId: videoId,
      title: videoInfo.title,
      channelName: videoInfo.channelName,
      publishDate: videoInfo.publishDate,
      thumbnail: videoInfo.thumbnail,
      toxicityScore: toxicityScore,
      biasTags: biasTags,
      emotions: {
        anger: 0.1,
        joy: 0.1,
        trust: 0.1,
        fear: 0.1,
        sadness: 0.1,
        surprise: 0.1,
        disgust: 0.1
      }
    };

  } catch (error) {
    console.error('Error creating structured result:', error);
    // Fallback to simple result
    return {
      videoId: videoId,
      title: `Video ${videoId}`,
      channelName: 'Unknown Channel',
      publishDate: new Date().toISOString(),
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      toxicityScore: 5,
      biasTags: ['Unknown'],
      emotions: {
        anger: 0.1,
        joy: 0.1,
        trust: 0.1,
        fear: 0.1,
        sadness: 0.1,
        surprise: 0.1,
        disgust: 0.1
      }
    };
  }
}

// Helper function to get YouTube video information (fallback)
async function getYouTubeVideoInfo(videoId: string) {
  try {
    // Use YouTube Data API v3 to get video information
    const apiKey = await settings.get<string>('youtubeApiKey');
    if (!apiKey) {
      throw new Error('YouTube API key not configured. Set it using: npx devvit settings set youtubeApiKey');
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,statistics`
    );
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = data.items[0];
    return {
      title: video.snippet.title,
      channelName: video.snippet.channelTitle,
      publishDate: video.snippet.publishedAt,
      thumbnail: video.snippet.thumbnails.maxres?.url || 
                 video.snippet.thumbnails.high?.url || 
                 video.snippet.thumbnails.standard?.url || 
                 video.snippet.thumbnails.default?.url || 
                 `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      description: video.snippet.description,
    };
  } catch (error) {
    console.error('Error fetching YouTube video info:', error);
    // Return fallback data
    return {
      title: `Video ${videoId}`,
      channelName: 'Unknown Channel',
      publishDate: new Date().toISOString(),
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      description: '',
    };
  }
}

// Helper function to analyze video content using OpenAI (fallback)
async function analyzeVideoContent(videoId: string, videoInfo: any): Promise<YouTubeAnalysisResult> {
  try {
    const openaiApiKey = await settings.get<string>('openaiApiKey');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Set it using: npx devvit settings set openaiApiKey');
    }

    // Create analysis prompt
    const prompt = `Analyze the following YouTube video for toxicity and bias:

Title: ${videoInfo.title}
Channel: ${videoInfo.channelName}
Description: ${videoInfo.description?.substring(0, 1000) || 'No description available'}

Please provide:
1. Toxicity score (0-10, where 10 is highly toxic)
2. Brief summary (2-3 sentences explaining the key findings)
3. Bias assessment - List any detected biases from: Political, Cultural, Gender, Racial, Religious, Economic, Ideological. If no specific biases detected, use ["None Detected"]

Format your response as JSON with these fields:
{
  "toxicityScore": number,
  "summary": string,
  "biasTags": string[] (must always include at least one value, even if it's "None Detected")
}`;

    // Create an AbortController with a 45 second timeout (production needs more time)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content moderator analyzing YouTube videos for toxicity, bias, and emotional impact. Be objective and provide concise analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500  // Reduced from 1000 to speed up response
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    const analysisText = data.choices[0].message.content;

    // Parse the JSON response from OpenAI
    let analysisData;
    try {
      // Extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw analysisText:', analysisText);
      // Fallback to default values
      analysisData = {
        toxicityScore: 5,
        summary: analysisText.substring(0, 300) || 'Unable to generate summary. Please try again.',
        biasTags: ['Analysis Format Error']
      };
      console.log('📊 Using fallback analysisData with biasTags:', analysisData.biasTags);
    }

    console.log('📊 analysisData from OpenAI:', analysisData);
    console.log('📊 analysisData.toxicityScore:', analysisData.toxicityScore);

    const result = {
      videoId,
      title: videoInfo.title,
      channelName: videoInfo.channelName,
      publishDate: videoInfo.publishDate,
      thumbnail: videoInfo.thumbnail,
      toxicityScore: analysisData.toxicityScore || 5,
      summary: analysisData.summary || 'Analysis completed. Review the toxicity score for details.',
      biasTags: analysisData.biasTags || ['None Detected']
    };

    console.log('📊 Final result.toxicityScore:', result.toxicityScore);
    console.log('📊 Final analysis result with biasTags:', result.biasTags);
    return result;

  } catch (error) {
    console.error('Error analyzing video content:', error);
    // Return fallback analysis
    const fallbackResult = {
      videoId,
      title: videoInfo.title,
      channelName: videoInfo.channelName,
      publishDate: videoInfo.publishDate,
      thumbnail: videoInfo.thumbnail,
      toxicityScore: 5,
      summary: 'Analysis could not be completed. Please try again or check your API configuration.',
      biasTags: ['Analysis Unavailable'],
      // emotions: {
      //   anger: 0.1,
      //   joy: 0.1,
      //   trust: 0.1,
      //   fear: 0.1,
      //   sadness: 0.1,
      //   surprise: 0.1,
      //   disgust: 0.1
      // }
    };
    console.log('📊 Returning error fallback with biasTags:', fallbackResult.biasTags);
    return fallbackResult;
  }
}

// Use router middleware
app.use(router);

// Global error handler for unhandled errors
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred'
    });
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Promise Rejection:', reason);
  // Don't exit the process, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
