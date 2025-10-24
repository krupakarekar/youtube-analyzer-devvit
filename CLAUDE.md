# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a YouTube Content Analyzer built on Reddit's Devvit platform. It analyzes YouTube videos for toxicity, bias, and emotional impact using OpenAI's GPT-4 API and YouTube transcript extraction.

## Commands

### Development
- `npm run dev` - Start development server with live reload (runs client, server, and devvit in parallel)
- `npm run dev:client` - Build client in watch mode only
- `npm run dev:server` - Build server in watch mode only
- `npm run dev:vite` - Run Vite dev server on port 7474

### Build & Deploy
- `npm run build` - Build both client and server
- `npm run build:client` - Build client only (Vite)
- `npm run build:server` - Build server only (Vite)
- `npm run deploy` - Build and upload to Devvit
- `npm run launch` - Build, deploy, and publish for review

### Code Quality
- `npm run check` - Run type-check, lint:fix, and prettier
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint check
- `npm run lint:fix` - ESLint auto-fix

### Authentication
- `npm run login` - Log in to Reddit Devvit

## Architecture

### Three-Layer Structure

This is a Devvit React app with three distinct layers:

1. **Client** (`/src/client`): Full-screen webview React application
   - Built with React 19, Vite, and Tailwind CSS
   - Communicates with server via `fetch('/api/endpoint')`
   - Cannot use websockets or web-incompatible libraries
   - Main UI is in `App.tsx` with animated components using Framer Motion

2. **Server** (`/src/server`): Serverless Node.js backend
   - Built with Express on top of Devvit's serverless runtime
   - Access to Redis via `import { redis } from '@devvit/web/server'`
   - Access to Reddit API via `import { reddit } from '@devvit/web/server'`
   - Main entry point is `index.ts`
   - **Environment constraints**: No `fs`, `http`, `https`, `net`, websockets, or HTTP streaming
   - Use `fetch` instead of http/https modules
   - Read-only filesystem (cannot write files)

3. **Shared** (`/src/shared`): Types and code shared between client and server
   - Primarily TypeScript type definitions in `/types/api.ts`

### YouTube Analysis Flow

```
Client → POST /api/analyze → Server analyzes with youtube-transcript + OpenAI → Returns structured result
```

The analysis process:
1. Extracts video ID from YouTube URL
2. Fetches transcript using `youtube-transcript` npm package
3. Sends transcript to OpenAI GPT-4 for analysis
4. Returns toxicity score (0-10), bias tags, and emotional impact scores
5. Fallback to YouTube Data API if transcript unavailable

### API Endpoints

- `GET /api/init` - Initialize app with postId, count, and username
- `POST /api/increment` - Increment Redis counter (example endpoint)
- `POST /api/decrement` - Decrement Redis counter (example endpoint)
- `POST /api/analyze` - Analyze YouTube video (main feature)
- `POST /internal/on-app-install` - Triggered when app is installed to subreddit
- `POST /internal/menu/post-create` - Create new post from subreddit menu

### Environment Variables

Required for full functionality:
- `OPENAI_API_KEY` - OpenAI API key for content analysis
- `YOUTUBE_API_KEY` - YouTube Data API key (fallback when transcripts unavailable)

Copy `env.template` to `.env` and fill in values.

### Build Output

- Client builds to: `dist/client/index.html`
- Server builds to: `dist/server/index.cjs` (CommonJS format)
- Configuration in `devvit.json` points to these paths

## Development Guidelines

### TypeScript
- Prefer type aliases over interfaces
- Shared types live in `/src/shared/types/api.ts`

### Server Code
- This is serverless (like AWS Lambda) - no stateful in-memory processes
- Cannot run SQLite or maintain long-lived connections
- Use Redis for persistence
- Use `fetch` for HTTP requests, not http/https modules

### Client Code
- Must be web-compatible
- Follow React hooks rules
- No websockets (query devvit_search for "realtime" for alternatives)

### General
- Assume TypeScript, Vite, Tailwind, ESLint, and Prettier configuration is correct
- Bugs are more likely in application code than build configuration

## Testing & Deployment

The app is configured to deploy to the `yt_analyzer_dev` subreddit for testing (see `devvit.json`).

Test development by running `npm run dev` which uses `devvit playtest`.
