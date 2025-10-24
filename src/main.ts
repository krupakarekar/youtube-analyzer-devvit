import { Devvit, SettingScope } from '@devvit/public-api';

// Configure app-level settings for API keys
Devvit.addSettings([
  {
    type: 'string',
    name: 'openai-api-key',
    label: 'OpenAI API Key',
    scope: SettingScope.App,
    isSecret: true,
    helpText: 'API key for OpenAI GPT-4 content analysis. Get yours at https://platform.openai.com/api-keys',
  },
  {
    type: 'string',
    name: 'youtube-api-key',
    label: 'YouTube Data API Key',
    scope: SettingScope.App,
    isSecret: true,
    helpText: 'API key for YouTube Data API v3 (used as fallback). Get yours at https://console.developers.google.com/',
  },
]);

// Configure the Devvit app
Devvit.configure({
  http: true,
  redis: true,
});

export default Devvit;
