import {runFfmpegBufferCommand, probeMediaDurationSeconds} from "../sound-engine/ffmpeg";

export const extractSpeakerFrame = async (videoPath: string, timestampSeconds?: number): Promise<Buffer> => {
  let targetTime = timestampSeconds;
  
  if (targetTime === undefined) {
    const duration = await probeMediaDurationSeconds(videoPath);
    // Default to the middle of the video if no timestamp is provided.
    // If duration probing fails, default to 1 second.
    targetTime = duration ? duration / 2 : 1;
  }

  // Use ffmpeg to quickly seek to the target time and extract exactly 1 frame as JPEG.
  const args = [
    "-ss", String(targetTime),
    "-i", videoPath,
    "-vframes", "1",
    "-q:v", "2", // High quality JPEG
    "-f", "image2",
    "-c:v", "mjpeg",
    "pipe:1" // Output to stdout
  ];

  const result = await runFfmpegBufferCommand(args, {
    logCommand: (cmd) => console.log(`[Thumbnail] Extracting frame: ${cmd}`)
  });

  if (!result.stdout || result.stdout.length === 0) {
    throw new Error("Failed to extract frame from video (stdout was empty)");
  }

  return result.stdout;
};
