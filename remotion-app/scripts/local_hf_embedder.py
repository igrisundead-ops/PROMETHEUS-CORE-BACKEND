import argparse
import json
import os
import sys
import time
from typing import Any


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def to_list(value: Any) -> list[Any]:
    if hasattr(value, "tolist"):
        return value.tolist()
    return list(value)


def measure_serialization_ms(payload: dict[str, Any]) -> float:
    start = time.perf_counter()
    json.dumps(payload)
    return (time.perf_counter() - start) * 1000


def main() -> int:
    startup_started_at = time.perf_counter()
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--use-fp16", default="false")
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()

    use_fp16 = str(args.use_fp16).strip().lower() == "true"

    runtime = None
    model = None
    model_load_started_at = time.perf_counter()

    try:
        from FlagEmbedding import BGEM3FlagModel

        if args.model_name.strip().lower() == "baai/bge-m3":
            model = BGEM3FlagModel(args.model_name, use_fp16=use_fp16)
            runtime = "FlagEmbedding"
    except Exception:
        model = None

    if model is None:
        try:
            from sentence_transformers import SentenceTransformer

            model = SentenceTransformer(
                args.model_name,
                trust_remote_code=True,
                local_files_only=True,
            )
            runtime = "sentence-transformers"
        except Exception as error:
            emit(
                {
                    "type": "error",
                    "error": (
                        "No local embedding runtime could be loaded. "
                        "Install `sentence-transformers` or `FlagEmbedding`. "
                        f"Model: {args.model_name}. Details: {error}"
                    ),
                }
            )
            return 1

    ready_payload = {
        "type": "ready",
        "model": args.model_name,
        "runtime": runtime,
        "process_id": os.getpid(),
        "timings": {
            "startup_ms": round((time.perf_counter() - startup_started_at) * 1000, 3),
            "model_load_ms": round((time.perf_counter() - model_load_started_at) * 1000, 3),
        },
    }
    ready_payload["timings"]["serialization_ms"] = round(measure_serialization_ms(ready_payload), 3)
    emit(
        ready_payload
    )

    for raw_line in sys.stdin:
        request_started_at = time.perf_counter()
        line = raw_line.strip()
        if not line:
            continue

        parse_started_at = time.perf_counter()
        request = json.loads(line)
        parsed_at = time.perf_counter()
        request_id = str(request.get("id", ""))
        texts = request.get("texts", [])

        try:
            encode_started_at = time.perf_counter()
            if runtime == "FlagEmbedding":
                output = model.encode(texts, batch_size=max(1, args.batch_size), max_length=8192)
                dense = output.get("dense_vecs", [])
                embeddings = [to_list(item) for item in dense]
            else:
                dense = model.encode(
                    texts,
                    batch_size=max(1, args.batch_size),
                    normalize_embeddings=True,
                    convert_to_numpy=True,
                    show_progress_bar=False,
                )
                embeddings = [to_list(item) for item in dense]
            encoded_at = time.perf_counter()
            response_payload = {
                "id": request_id,
                "embeddings": embeddings,
                "text_count": len(texts),
                "timings": {
                    "input_parse_ms": round((parsed_at - parse_started_at) * 1000, 3),
                    "encode_ms": round((encoded_at - encode_started_at) * 1000, 3),
                    "output_prep_ms": round((time.perf_counter() - encoded_at) * 1000, 3),
                    "total_ms": round((time.perf_counter() - request_started_at) * 1000, 3),
                },
            }
            response_payload["timings"]["serialization_ms"] = round(measure_serialization_ms(response_payload), 3)
            emit(response_payload)
        except Exception as error:
            emit({"id": request_id, "error": str(error)})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
