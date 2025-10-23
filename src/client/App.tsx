import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  Brain, 
  Heart, 
  Play, 
  Calendar, 
  User, 
  Loader2,
  Youtube,
  Shield,
  TrendingUp
} from 'lucide-react';
import { YouTubeAnalysisResult } from '../shared/types/api';

type AppState = 'idle' | 'loading' | 'success' | 'error';

export const App = () => {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<AppState>('idle');
  const [analysisResult, setAnalysisResult] = useState<YouTubeAnalysisResult | null>(null);
  const [error, setError] = useState<string>('');

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^[a-zA-Z0-9_-]{11}$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1] || null;
    }
    return null;
  };

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError('Please enter a valid YouTube URL or video ID');
      setState('error');
      return;
    }

    setState('loading');
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, videoId }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result: YouTubeAnalysisResult = await response.json();
      setAnalysisResult(result);
      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze video');
      setState('error');
    }
  };

  const resetAnalysis = () => {
    setState('idle');
    setAnalysisResult(null);
    setError('');
    setUrl('');
  };

  const getToxicityColor = (score: number) => {
    if (score <= 3) return 'text-green-600 bg-green-100';
    if (score <= 6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getToxicityGradient = (score: number) => {
    if (score <= 3) return 'from-green-400 to-green-600';
    if (score <= 6) return 'from-yellow-400 to-yellow-600';
    return 'from-red-400 to-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
              <Youtube className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              YouTube Content Analyzer
        </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Analyze YouTube videos for toxicity, bias, and emotional impact
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6"
        >
          {/* Input Section */}
          <div className="mb-6">
            <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              YouTube URL or Video ID
            </label>
            <div className="flex gap-3">
              <input
                id="youtube-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=dQw4w9WgXcQ"
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                disabled={state === 'loading'}
              />
              <button
                onClick={handleAnalyze}
                disabled={state === 'loading' || !url.trim()}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {state === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Analyze
        </button>
            </div>
          </div>

          {/* Results Section */}
          <AnimatePresence>
            {state === 'success' && analysisResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6"
              >
                {/* Video Preview */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex gap-4">
                    <img
                      src={analysisResult.thumbnail}
                      alt={analysisResult.title}
                      className="w-32 h-24 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2 line-clamp-2">
                        {analysisResult.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {analysisResult.channelName}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(analysisResult.publishDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toxicity Score */}
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h4 className="font-semibold text-gray-900 dark:text-white">Toxicity Score</h4>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span>Score</span>
                        <span className="font-medium">{analysisResult.toxicityScore}/10</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(analysisResult.toxicityScore / 10) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-3 rounded-full bg-gradient-to-r ${getToxicityGradient(analysisResult.toxicityScore)}`}
                        />
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getToxicityColor(analysisResult.toxicityScore)}`}>
                      {analysisResult.toxicityScore <= 3 ? 'Low' : 
                       analysisResult.toxicityScore <= 6 ? 'Medium' : 'High'}
                    </div>
                  </div>
                </div>

                {/* Bias Tags */}
                {analysisResult.biasTags.length > 0 && (
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">Detected Biases</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.biasTags.map((bias, index) => (
                        <motion.span
                          key={bias}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
                        >
                          {bias}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emotional Impact */}
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Heart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h4 className="font-semibold text-gray-900 dark:text-white">Emotional Impact</h4>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(analysisResult.emotions).map(([emotion, value]) => (
                      <div key={emotion} className="flex items-center gap-3">
                        <span className="w-16 text-sm text-gray-600 dark:text-gray-400 capitalize">
                          {emotion}
                        </span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${value * 100}%` }}
                            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                            className="h-2 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full"
                          />
                        </div>
                        <span className="w-8 text-sm text-gray-600 dark:text-gray-400 text-right">
                          {Math.round(value * 100)}%
        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reset Button */}
                <div className="flex justify-center pt-4">
        <button
                    onClick={resetAnalysis}
                    className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
                    Analyze Another Video
        </button>
      </div>
              </motion.div>
            )}

            {state === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <h4 className="font-semibold text-red-800 dark:text-red-300">Analysis Failed</h4>
                </div>
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        <button
                  onClick={resetAnalysis}
                  className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
        >
                  Try Again
        </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {state === 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Ready to Analyze
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enter a YouTube URL above to get started with content analysis
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
