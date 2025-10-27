import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse, YouTubeAnalysisResult } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort, settings } from '@devvit/web/server';
import { createPost } from './core/post';
import { fetchTranscript } from '@egoist/youtube-transcript-plus';

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

      // Use transcript-based analysis
      const analysisResult = await analyzeVideoWithTranscript(videoId);
      
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
      res.status(500).json({
        error: 'ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
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

// Main analysis function using transcripts (converted from Python script)
async function analyzeVideoWithTranscript(videoId: string): Promise<YouTubeAnalysisResult | { error: string }> {
  try {
    console.log(`🎥 Video ID: ${videoId}`);
    console.log('='.repeat(80));

    // Fetch transcript using JavaScript package
    console.log('\n📥 Fetching transcript...');
    let transcript;
    try {
      // Use youtube-transcript-plus to fetch transcript
      const response = await fetchTranscript(videoId);
      
      if (!response || !response.segments || response.segments.length === 0) {
        console.log('⚠️ No transcript available for this video');
        // Try fallback to metadata-based analysis
        console.log('⚠️ Attempting fallback to metadata-based analysis...');
        return await fallbackToMetadataAnalysis(videoId, new Error('No transcript available'));
      }

      // Map the response segments to our TranscriptItem interface
      transcript = response.segments.map((segment: { text: string; duration: number; offset: number }) => ({
        text: segment.text,
        duration: segment.duration,
        offset: segment.offset
      }));
      
      console.log('✅ Transcript fetch successful');
      console.log(`\n✅ Transcript retrieved: ${transcript.length} entries`);
    } catch (transcriptError) {
      console.error('❌ Transcript fetch failed:', transcriptError);
      // Try fallback to metadata-based analysis
      console.log('⚠️ Attempting fallback to metadata-based analysis...');
      return await fallbackToMetadataAnalysis(videoId, transcriptError);
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

    // Analyze content with OpenAI
    console.log('\n🔍 Analyzing content with AI...');
    console.log('='.repeat(80));

    let analysis;
    try {
      analysis = await analyzeContent(fullText);
      console.log('✅ OpenAI analysis successful');
    } catch (analysisError) {
      console.error('❌ OpenAI analysis failed:', analysisError);
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
}

// Fallback function for metadata-based analysis when transcript is unavailable
async function fallbackToMetadataAnalysis(videoId: string, _originalError: any): Promise<YouTubeAnalysisResult | { error: string }> {
  console.log('📋 Fetching video metadata for fallback analysis...');
  try {
    const videoInfo = await getYouTubeVideoInfo(videoId);
    console.log('✅ Video metadata fetched successfully');
    console.log('🔍 Analyzing video metadata...');
    const fallbackAnalysis = await analyzeVideoContent(videoId, videoInfo);
    console.log('✅ Metadata analysis completed');
    return fallbackAnalysis;
  } catch (fallbackError) {
    console.error('❌ Fallback analysis failed:', fallbackError);
    // Return a proper YouTubeAnalysisResult with default values
    return {
      videoId,
      title: `Video ${videoId}`,
      channelName: 'Unknown Channel',
      publishDate: new Date().toISOString(),
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      toxicityScore: 5,
      biasTags: ['Analysis Unavailable'],
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

Transcript:
${transcriptText.substring(0, 4000)}

Please provide:
- A toxicity score (0-10, where 10 is highly toxic)
- A bias assessment (types of bias detected and severity)
- A misinformation assessment (potential false claims identified)
- An overall summary

Format your response as a structured analysis.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content moderator analyzing video transcripts for toxicity, bias, and misinformation. Be objective and thorough.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    console.log(response);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
    
  } catch (error) {
    return `Error analyzing content: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
    const prompt = `Analyze the following YouTube video for toxicity, bias, and emotional impact:

Title: ${videoInfo.title}
Channel: ${videoInfo.channelName}
Description: ${videoInfo.description?.substring(0, 1000) || 'No description available'}

Please provide:
1. Toxicity score (0-10, where 10 is highly toxic)
2. Bias assessment (types of bias detected)
3. Emotional impact analysis (provide values between 0 and 1 for: anger, joy, trust, fear, sadness, surprise, disgust)

Format your response as JSON with these fields:
{
  "toxicityScore": number,
  "biasTags": string[],
  "emotions": {
    "anger": number,
    "joy": number,
    "trust": number,
    "fear": number,
    "sadness": number,
    "surprise": number,
    "disgust": number
  },
  "analysis": string
}`;

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
            content: 'You are an expert content moderator analyzing YouTube videos for toxicity, bias, and emotional impact. Be objective and thorough.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
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
      // Fallback to default values
      analysisData = {
        toxicityScore: 5,
        biasTags: ['Unknown'],
        emotions: {
          anger: 0.3,
          joy: 0.4,
          trust: 0.5,
          fear: 0.2,
          sadness: 0.3,
          surprise: 0.4,
          disgust: 0.2
        },
        analysis: analysisText
      };
    }

    return {
      videoId,
      title: videoInfo.title,
      channelName: videoInfo.channelName,
      publishDate: videoInfo.publishDate,
      thumbnail: videoInfo.thumbnail,
      toxicityScore: analysisData.toxicityScore || 5,
      biasTags: analysisData.biasTags || [],
      emotions: analysisData.emotions || {
        anger: 0.3,
        joy: 0.4,
        trust: 0.5,
        fear: 0.2,
        sadness: 0.3,
        surprise: 0.4,
        disgust: 0.2
      }
    };

  } catch (error) {
    console.error('Error analyzing video content:', error);
    // Return fallback analysis
    return {
      videoId,
      title: videoInfo.title,
      channelName: videoInfo.channelName,
      publishDate: videoInfo.publishDate,
      thumbnail: videoInfo.thumbnail,
      toxicityScore: 5,
      biasTags: ['Analysis Unavailable'],
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

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
