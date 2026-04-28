# Backend Local Dev

Run the backend locally on `http://localhost:8000` by default.

## Environment

- `PORT=8000`
- `STORAGE_DIR=./data`
- `MAX_UPLOAD_FILE_SIZE_BYTES=524288000`
- `CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3010,http://127.0.0.1:3010,http://localhost:3101,http://127.0.0.1:3101,http://localhost:4101,http://127.0.0.1:4101,http://localhost:5173,http://127.0.0.1:5173`
- `ASSEMBLYAI_API_KEY=`
- `GROQ_API_KEY=`
- `R2_ACCOUNT_ID=`
- `R2_ENDPOINT=`
- `R2_ACCESS_KEY_ID=`
- `R2_SECRET_ACCESS_KEY=`
- `R2_UPLOAD_BUCKET=prometheus-uploads`
- `R2_PUBLIC_UPLOADS_BASE=`
- `R2_UPLOAD_URL_EXPIRES_SECONDS=600`

## Install And Run

```bash
npm install
npm run dev
```

## Frontend Base URL

Set the frontend env to the backend origin during local development:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Public API

### `POST /api/upload-url`

Generates a short-lived presigned PUT URL for direct browser upload to Cloudflare R2.

Accepted fields:

- `filename`
- `contentType`
- `userId` optional

Returns:

```json
{
  "uploadUrl": "https://prometheus-uploads.<account>.r2.cloudflarestorage.com/uploads/josh/...",
  "key": "uploads/josh/...",
  "bucket": "prometheus-uploads",
  "publicUrl": "https://cdn.example.com/uploads/josh/...",
  "expiresInSeconds": 600,
  "requiredHeaders": {
    "Content-Type": "video/mp4"
  },
  "method": "PUT"
}
```

Important:

- The browser upload must send the same `Content-Type` header that was signed into the URL.
- If `R2_PUBLIC_UPLOADS_BASE` is empty, `publicUrl` will be `null`.

### `POST /api/process`

Starts the backend pipeline from an uploaded R2 object.

Accepted fields:

- `bucket`
- `key`
- `filename` optional
- `contentType` optional
- `userId` optional
- `mediaUrl` optional
- `metadata` optional

Returns:

```json
{
  "ok": true,
  "jobId": "edit_mo123abc",
  "sessionId": "edit_mo123abc",
  "status": "queued",
  "bucket": "prometheus-uploads",
  "key": "uploads/josh/...",
  "session": {
    "id": "edit_mo123abc",
    "status": "uploaded",
    "storageKey": "uploads/josh/...",
    "previewStatus": "idle"
  },
  "urls": {
    "status": "/api/edit-sessions/edit_mo123abc/status",
    "preview": "/api/edit-sessions/edit_mo123abc/preview",
    "render": "/api/edit-sessions/edit_mo123abc/render",
    "events": "/api/edit-sessions/edit_mo123abc/events"
  }
}
```

### R2 Bucket CORS

For direct browser uploads, configure the R2 bucket to allow the frontend origin and `PUT` requests with `Content-Type`.

Example:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3010",
      "http://localhost:3101",
      "https://your-frontend-domain.com"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### `POST /api/generate-viral-clips`

Accepted fields:

- `projectId`
- `videoId`
- `targetPlatform`
- `clipCountMin`
- `clipCountMax`
- `prompt` optional
- `sourceMediaRef` optional
- `creatorNiche` optional
- `assets` optional
- `metadataOverrides` optional
- `providedTranscript` optional

Returns:

```json
{
  "jobId": "job_123",
  "status": "received",
  "stage": "queued",
  "urls": {
    "job": "/api/jobs/job_123",
    "result": "/api/jobs/job_123/result"
  }
}
```

### `GET /api/jobs/:jobId`

Returns job status, public stage, progress, and artifact availability.

### `GET /api/jobs/:jobId/result`

Returns the clip-selection artifact once ready.

## Notes

- The backend accepts either JSON or multipart requests.
- Multipart uploads stream to disk and allow source videos up to the configured upload limit.
- If a transcript is already supplied, it is reused.
- If no transcript exists and `ASSEMBLYAI_API_KEY` is present, the backend will transcribe the source media.
- `stage` values exposed to the frontend are mapped to `queued`, `transcribing`, `segmenting`, `heuristic_scoring`, `llm_scoring`, `ranking`, `completed`, and `failed`.
