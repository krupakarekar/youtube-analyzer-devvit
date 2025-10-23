export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export type YouTubeAnalysisResult = {
  videoId: string;
  title: string;
  channelName: string;
  publishDate: string;
  thumbnail: string;
  toxicityScore: number; // 0-10
  biasTags: string[];
  emotions: {
    anger: number;
    joy: number;
    trust: number;
    fear: number;
    sadness: number;
    surprise: number;
    disgust: number;
  };
};

export type AnalysisError = {
  error: string;
  message: string;
};
