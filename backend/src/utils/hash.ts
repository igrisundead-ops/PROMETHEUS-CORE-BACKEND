import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";

export const sha256Text = (value: string): string => {
  return createHash("sha256").update(value).digest("hex");
};

export const sha256File = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
};
