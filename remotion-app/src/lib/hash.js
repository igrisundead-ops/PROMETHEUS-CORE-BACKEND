import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
export const sha256File = async (filePath) => {
    const hash = createHash("sha256");
    await new Promise((resolve, reject) => {
        const stream = createReadStream(filePath);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("error", reject);
        stream.on("end", resolve);
    });
    return hash.digest("hex");
};
export const sha256Text = (value) => {
    return createHash("sha256").update(value).digest("hex");
};
