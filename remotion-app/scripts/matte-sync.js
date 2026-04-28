import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import videoMetadata from "../src/data/video.metadata.json";
const cwd = process.cwd();
const defaultCacheDir = path.join(cwd, "public", "mattes", "female-coach");
const cacheDir = process.argv[2] ? path.resolve(process.argv[2]) : defaultCacheDir;
const manifestPath = path.join(cwd, "src", "data", "video.matte.json");
const firstExisting = async (files) => {
    for (const file of files) {
        try {
            await access(path.join(cacheDir, file));
            return file;
        }
        catch {
            continue;
        }
    }
    return null;
};
const run = async () => {
    await mkdir(cacheDir, { recursive: true });
    await readdir(cacheDir);
    const foregroundFile = await firstExisting([
        "foreground.webm",
        "foreground.mov",
        "foreground.mp4",
        "fgr.webm",
        "fgr.mov",
        "fgr.mp4"
    ]);
    const alphaFile = await firstExisting([
        "alpha.webm",
        "alpha.mov",
        "alpha.mp4",
        "pha.webm",
        "pha.mov",
        "pha.mp4"
    ]);
    const status = foregroundFile && alphaFile ? "ready" : foregroundFile || alphaFile ? "partial" : "missing";
    const manifest = {
        id: "female-coach-rvm",
        sourceVideo: "input-video.mp4",
        alphaSrc: alphaFile ? path.posix.join("mattes", "female-coach", alphaFile) : null,
        foregroundSrc: foregroundFile ? path.posix.join("mattes", "female-coach", foregroundFile) : null,
        width: videoMetadata.width,
        height: videoMetadata.height,
        fps: videoMetadata.fps,
        status,
        provider: "offline-cache",
        cacheDir: path.relative(cwd, cacheDir).replace(/\\/g, "/"),
        updatedAt: new Date().toISOString()
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`Matte manifest updated at ${manifestPath}`);
    console.log(`Status: ${status}`);
};
run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
