import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
const execFileAsync = promisify(execFile);
const ffprobeSchema = z.object({
    streams: z.array(z.object({
        codec_type: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
        avg_frame_rate: z.string().optional(),
        r_frame_rate: z.string().optional()
    })),
    format: z.object({
        duration: z.string()
    })
});
const parseFps = (value) => {
    if (!value) {
        return 30;
    }
    const [numRaw, denRaw] = value.split("/");
    const num = Number(numRaw);
    const den = Number(denRaw ?? "1");
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
        return 30;
    }
    return num / den;
};
export const probeVideoMetadata = async (videoPath) => {
    const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        videoPath
    ]);
    const raw = JSON.parse(stdout);
    const parsed = ffprobeSchema.parse(raw);
    const videoStream = parsed.streams.find((stream) => stream.codec_type === "video");
    if (!videoStream || !videoStream.width || !videoStream.height) {
        throw new Error("Could not resolve video stream metadata from ffprobe output.");
    }
    const fps = parseFps(videoStream.avg_frame_rate || videoStream.r_frame_rate);
    const durationSeconds = Number(parsed.format.duration);
    const durationInFrames = Math.max(1, Math.round(durationSeconds * fps));
    return {
        width: videoStream.width,
        height: videoStream.height,
        fps,
        durationSeconds,
        durationInFrames
    };
};
