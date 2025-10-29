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
  summary: string; // Brief analysis summary
  biasTags: string[];
};

export type AnalysisError = {
  error: string;
  message: string;
};
