import argparse
import os
import sys
import time

from huggingface_hub import snapshot_download


REQUIRED_PATTERNS = [
    "1_Pooling/config.json",
    "colbert_linear.pt",
    "config.json",
    "config_sentence_transformers.json",
    "model.safetensors",
    "model.safetensors.index.json",
    "modules.json",
    "pytorch_model.bin",
    "pytorch_model-*.bin",
    "sparse_linear.pt",
    "sentence_bert_config.json",
    "sentencepiece.bpe.model",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
]


def configure_environment() -> None:
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "600")
    os.environ.setdefault("HF_HUB_ETAG_TIMEOUT", "60")
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    os.environ.setdefault("PYTHONUTF8", "1")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-name", default="BAAI/bge-m3")
    parser.add_argument("--attempts", type=int, default=12)
    parser.add_argument("--retry-delay-seconds", type=int, default=20)
    args = parser.parse_args()

    configure_environment()

    for attempt in range(1, max(1, args.attempts) + 1):
        try:
            print(
                f"[prefetch-bge-m3] attempt {attempt}/{args.attempts}: downloading {args.model_name}",
                flush=True,
            )
            path = snapshot_download(
                args.model_name,
                allow_patterns=REQUIRED_PATTERNS,
                max_workers=1,
            )
            print(f"[prefetch-bge-m3] cached at {path}", flush=True)
            return 0
        except Exception as error:
            print(f"[prefetch-bge-m3] attempt {attempt} failed: {error}", file=sys.stderr, flush=True)
            if attempt >= args.attempts:
                return 1
            time.sleep(max(1, args.retry_delay_seconds))

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
