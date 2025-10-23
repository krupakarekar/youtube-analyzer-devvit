import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      // Splash Screen Configuration
      buttonLabel: 'Tap to Start',
      description: 'An exciting interactive experience',
      heading: 'Welcome to the Game!',
      appIconUri: 'default-icon.png',
    },
    postData: {
      gameState: 'initial',
      score: 0,
    },
    subredditName: subredditName,
    title: 'yt-analyzer',
  });
};
