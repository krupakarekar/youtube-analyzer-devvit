import openai
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Try different import methods
try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    print("Error: youtube_transcript_api not installed properly")
    print("Run: pip install youtube-transcript-api")
    exit(1)

# Set your OpenAI API key
openai.api_key = os.environ.get("OPENAI_API_KEY")

# Verify API key is loaded
if not openai.api_key:
    print("❌ Error: OPENAI_API_KEY not found in environment variables")
    print("Make sure your .env file contains: OPENAI_API_KEY=sk-proj-...")
    exit(1)
else:
    print(f"✅ API key loaded: {openai.api_key[:20]}...")

def get_full_transcript_text(transcript):
    """Combine all transcript entries into a single text"""
    full_text = ""
    for entry in transcript:
        if isinstance(entry, dict):
            full_text += entry.get('text', '') + " "
        else:
            # Handle object attributes
            full_text += str(getattr(entry, 'text', entry)) + " "
    return full_text.strip()

def analyze_content(transcript_text, video_id):
    """Use OpenAI to analyze transcript for toxicity, bias, and misinformation"""
    
    prompt = f"""Analyze the following YouTube video transcript for:

1. **Toxicity**: Check for hate speech, harassment, profanity, threats, or harmful content
2. **Bias**: Identify any political, cultural, gender, racial, or ideological biases
3. **Misinformation**: Look for false claims, misleading statements, or unverified facts

Transcript:
{transcript_text[:4000]}  

Please provide:
- A toxicity score (0-10, where 10 is highly toxic)
- A bias assessment (types of bias detected and severity)
- A misinformation assessment (potential false claims identified)
- An overall summary

Format your response as a structured analysis."""

    try:
        response = openai.chat.completions.create(
            model="gpt-4",  # or "gpt-3.5-turbo" for faster/cheaper analysis
            messages=[
                {"role": "system", "content": "You are an expert content moderator analyzing video transcripts for toxicity, bias, and misinformation. Be objective and thorough."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        return f"Error analyzing content: {str(e)}"

def main():
    # Get video ID from environment variable or use default
    video_id = os.environ.get("VIDEO_ID", "5NojPQTNx9s")
    print(f"🎥 Video ID: {video_id}")
    print("=" * 80)
    
    # Get transcript using the new API method
    print("\n📥 Fetching transcript...")
    api = YouTubeTranscriptApi()
    
    try:
        # Use list method to get available transcripts
        transcript_list_info = api.list(video_id)
        print(f"Available transcripts: {transcript_list_info}")
        
        # Fetch the actual transcript
        result = api.fetch(video_id)
        
        # Convert result to list and examine structure
        result_list = list(result)
        print(f"\n📊 Fetched {len(result_list)} transcript(s)")
        
        # Get first result
        if len(result_list) > 0:
            first_result = result_list[0]
            
            # Try different ways to access the data
            if hasattr(first_result, '__dict__'):
                print(f"Result attributes: {first_result.__dict__.keys()}")
                result_dict = first_result.__dict__
            else:
                result_dict = first_result
            
            # Print the structure to understand it
            print(f"\nResult structure preview:")
            if isinstance(result_dict, dict):
                for key in list(result_dict.keys())[:5]:
                    print(f"  {key}: {type(result_dict[key])}")
            
            # Try to extract transcript
            if 'tracks' in result_dict:
                tracks = result_dict['tracks']
                if len(tracks) > 0:
                    transcript = tracks[0].get('transcript', [])
                else:
                    print("No tracks found")
                    return
            elif hasattr(first_result, 'tracks'):
                transcript = first_result.tracks[0]['transcript']
            else:
                # The result itself might be the transcript
                transcript = result_list
            
            print(f"\n✅ Transcript retrieved: {len(transcript)} entries")
            
            # Show first few entries
            print("\n📜 First 10 entries of transcript:")
            print("-" * 80)
            for i, entry in enumerate(transcript[:10]):
                if isinstance(entry, dict):
                    text = entry.get('text', '')
                    start = entry.get('start', 0)
                    print(f"[{start}s] {text}")
                else:
                    # Handle object
                    text = getattr(entry, 'text', str(entry))
                    start = getattr(entry, 'start', 0)
                    print(f"[{start}s] {text}")
            
            # Get full transcript text
            full_text = get_full_transcript_text(transcript)
            print(f"\n📊 Total transcript length: {len(full_text)} characters")
            
            # Analyze content
            print("\n🔍 Analyzing content with AI...")
            print("=" * 80)
            
            analysis = analyze_content(full_text, video_id)
            
            print("\n🤖 AI ANALYSIS RESULTS:")
            print("=" * 80)
            print(analysis)
            print("=" * 80)
            
            # Parse the analysis and return structured JSON
            try:
                # Extract toxicity score from analysis text
                toxicity_score = 5  # Default score
                if "toxicity score" in analysis.lower():
                    import re
                    score_match = re.search(r'(\d+)', analysis)
                    if score_match:
                        toxicity_score = int(score_match.group(1))
                
                # Extract bias tags
                bias_tags = []
                if "bias" in analysis.lower():
                    if "political" in analysis.lower():
                        bias_tags.append("Political")
                    if "cultural" in analysis.lower():
                        bias_tags.append("Cultural")
                    if "gender" in analysis.lower():
                        bias_tags.append("Gender")
                    if "racial" in analysis.lower():
                        bias_tags.append("Racial")
                
                # Create structured result
                result = {
                    "videoId": video_id,
                    "title": f"Video {video_id}",
                    "channelName": "Unknown Channel",
                    "publishDate": "2024-01-01T00:00:00Z",
                    "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                    "toxicityScore": toxicity_score,
                    "biasTags": bias_tags,
                    "emotions": {
                        "anger": 0.3,
                        "joy": 0.4,
                        "trust": 0.5,
                        "fear": 0.2,
                        "sadness": 0.3,
                        "surprise": 0.4,
                        "disgust": 0.2
                    },
                    "analysis": analysis
                }
                
                # Output JSON result
                print(json.dumps(result, indent=2))
                
            except Exception as e:
                print(f"Error creating structured result: {e}")
                # Fallback to simple result
                result = {
                    "videoId": video_id,
                    "title": f"Video {video_id}",
                    "channelName": "Unknown Channel",
                    "publishDate": "2024-01-01T00:00:00Z",
                    "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                    "toxicityScore": 5,
                    "biasTags": ["Unknown"],
                    "emotions": {
                        "anger": 0.3,
                        "joy": 0.4,
                        "trust": 0.5,
                        "fear": 0.2,
                        "sadness": 0.3,
                        "surprise": 0.4,
                        "disgust": 0.2
                    },
                    "analysis": analysis
                }
                print(json.dumps(result, indent=2))
            
        else:
            print("No transcript data returned")
            # Return error result
            error_result = {
                "error": "No transcript data returned",
                "videoId": video_id
            }
            print(json.dumps(error_result, indent=2))
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        # Return error result
        error_result = {
            "error": f"Analysis failed: {str(e)}",
            "videoId": video_id
        }
        print(json.dumps(error_result, indent=2))

if __name__ == "__main__":
    main()