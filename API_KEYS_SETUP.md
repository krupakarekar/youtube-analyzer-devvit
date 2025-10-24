# API Keys Setup for YouTube Analyzer (Devvit Web)

## ✅ SOLUTION FOUND!

After extensive research and testing, here's the **correct way** to configure API keys for Devvit Web apps.

## Quick Start

### 1. Settings are Already Configured

The settings are defined in `devvit.json`:

```json
{
  "settings": {
    "global": {
      "openaiApiKey": {
        "type": "string",
        "label": "OpenAI API Key",
        "isSecret": true
      },
      "youtubeApiKey": {
        "type": "string",
        "label": "YouTube Data API Key",
        "isSecret": true
      }
    }
  }
}
```

### 2. Set Your API Keys

**Important:** Make sure your dev server is running (`npm run dev`) before setting secrets.

Run these commands and paste your API keys when prompted:

```bash
# Set OpenAI API Key
npx devvit settings set openaiApiKey

# Set YouTube API Key
npx devvit settings set youtubeApiKey
```

### 3. Verify Settings

Check that your keys are configured:

```bash
npx devvit settings list
```

You should see:

```
Key           Label                Is this a secret? Type
───────────── ──────────────────── ───────────────── ──────
openaiApiKey  OpenAI API Key       true              STRING
youtubeApiKey YouTube Data API Key true              STRING
```

### 4. Test Your App

Visit your playtest subreddit and try analyzing a YouTube video:
https://www.reddit.com/r/yt_analyzer_dev/?playtest=yt-analyzer

## How It Works

### Configuration (`devvit.json`)

Settings are defined in `devvit.json` under the `settings.global` section for app-wide secrets:

- **`isSecret: true`** - Marks the setting as a secret (encrypted storage)
- **Global scope** - Shared across all installations of your app
- **CLI-only access** - Only developers can set/view these values

### Code Access (`src/server/index.ts`)

The server code accesses settings using `settings.get()`:

```typescript
import { settings } from '@devvit/web/server';

// In your async function
const openaiApiKey = await settings.get<string>('openaiApiKey');
const youtubeApiKey = await settings.get<string>('youtubeApiKey');
```

### Security

- ✅ Keys are **encrypted** by Reddit's platform
- ✅ Keys are **never** committed to git
- ✅ Keys work in **both development and production**
- ✅ Only app developers can set/view secrets via CLI

## Troubleshooting

### "Unable to lookup the setting key"

**Solution:** Make sure you've built your app first:
```bash
npm run dev
```

The build process uploads the settings configuration to Reddit's servers.

### "At least one app installation is required"

**Solution:** Start the dev server, which creates a playtest installation:
```bash
npm run dev
```

### Settings not taking effect

1. Verify settings are set: `npx devvit settings list`
2. Check that the latest version is deployed (watch the dev server output)
3. Refresh your playtest page

## Production Deployment

The same API keys set via CLI will automatically work in production once you upload your app:

```bash
npx devvit upload
```

No additional configuration needed! The encrypted secrets are tied to your app and work across all environments.

## What We Learned

### ❌ What DOESN'T Work for Devvit Web:

1. **`Devvit.addSettings()`** in server code - This is for Devvit Blocks, not Devvit Web
2. **`devvit.local.json`** - Only for local development, not loaded in production/playtest
3. **`process.env`** - No way to set environment variables in Devvit runtime
4. **`secret.toml`** - Not a Devvit pattern

### ✅ What DOES Work:

1. **Settings in `devvit.json`** - The official Devvit Web way
2. **`settings.get()`** from `@devvit/web/server` - Access settings in code
3. **CLI commands** - `npx devvit settings set` to configure secrets

## API Key Regeneration

**⚠️ SECURITY NOTICE:** The API keys were previously exposed in version control. You MUST regenerate both keys:

- **OpenAI API Key**: https://platform.openai.com/api-keys
- **YouTube API Key**: https://console.developers.google.com/

After regenerating, set them using the commands above.

## Documentation

- **Devvit Settings & Secrets**: https://developers.reddit.com/docs/settings-and-secrets
- **Devvit Web Framework**: https://developers.reddit.com/docs/
- **Community Support**: r/Devvit

## Summary

For Devvit Web apps:
1. Define settings in `devvit.json` (not in code)
2. Access via `settings.get()` from `@devvit/web/server`
3. Set values via `npx devvit settings set`
4. Keys work in all environments automatically

That's it! Much simpler than we initially thought. 🎉
