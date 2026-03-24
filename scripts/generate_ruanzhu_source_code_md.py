from __future__ import annotations

import argparse
import os
from pathlib import Path


IGNORED_DIR_NAMES = {
    "node_modules",
    ".git",
    "dist",
    "build",
    ".idea",
    ".vscode",
    "__pycache__",
    "软著",
    ".next",
    ".next-build",
}

ALLOWED_SUFFIXES = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".vue",
    ".java",
    ".kt",
    ".kts",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".swift",
    ".c",
    ".cc",
    ".cpp",
    ".h",
    ".hpp",
    ".m",
    ".mm",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".less",
    ".sql",
    ".json",
    ".yml",
    ".yaml",
    ".toml",
    ".sh",
    ".bat",
    ".ps1",
    ".psm1",
    ".psd1",
}

ALLOWED_BASENAMES = {
    "Dockerfile",
    "Makefile",
}

EXCLUDED_BASENAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "tsconfig.tsbuildinfo",
}


def is_code_file(path: Path) -> bool:
    if not path.is_file():
        return False

    if path.name in EXCLUDED_BASENAMES:
        return False

    lower_name = path.name.lower()
    if lower_name.endswith((".min.js", ".min.css", ".map")):
        return False

    if path.name in ALLOWED_BASENAMES:
        return True

    return path.suffix.lower() in ALLOWED_SUFFIXES


def iter_code_files(root: Path) -> list[Path]:
    collected: list[Path] = []

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIR_NAMES]
        for filename in filenames:
            path = Path(dirpath) / filename
            if is_code_file(path):
                collected.append(path)

    return sorted(collected, key=lambda p: str(p.relative_to(root)).lower())


def decode_text(path: Path) -> str | None:
    data = path.read_bytes()
    if b"\x00" in data:
        return None

    for encoding in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue

    return data.decode("utf-8", errors="replace")


def clean_non_empty_lines(text: str) -> list[str]:
    cleaned: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue
        cleaned.append(line)
    return cleaned


def split_front_back(all_lines: list[str], head: int, tail: int) -> tuple[list[str], list[str]]:
    total = len(all_lines)
    if total <= head + tail:
        head_count = min(head, total)
        return all_lines[:head_count], all_lines[head_count:]

    return all_lines[:head], all_lines[-tail:]


def build_output_lines(front_lines: list[str], back_lines: list[str]) -> list[str]:
    lines: list[str] = []
    lines.append("=============== 前 30 页代码开始 ===============")
    lines.extend(front_lines)
    lines.append("=============== 前 30 页代码结束 ===============")
    lines.append("=============== 后 30 页代码开始 ===============")
    lines.extend(back_lines)
    lines.append("=============== 后 30 页代码结束 ===============")
    return lines


def parse_args() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[1]
    default_output = default_root / "软著" / "源程序代码.md"

    parser = argparse.ArgumentParser(
        description="生成软著申请所需《源程序代码》文档：清洗并截取前/后代码行。",
    )
    parser.add_argument("--root", type=Path, default=default_root, help="项目根目录（默认：脚本所在项目）")
    parser.add_argument("--output", type=Path, default=default_output, help="输出文件路径")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root: Path = args.root.resolve()
    output: Path = args.output.resolve()

    code_files = iter_code_files(root)
    all_lines: list[str] = []

    for file_path in code_files:
        text = decode_text(file_path)
        if text is None:
            continue
        all_lines.extend(clean_non_empty_lines(text))

    front_lines, back_lines = split_front_back(all_lines, head=2000, tail=2000)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(build_output_lines(front_lines, back_lines)), encoding="utf-8")

    extracted = len(front_lines) + len(back_lines)
    print(f"项目根目录: {root}")
    print(f"输出文件: {output}")
    print(f"纳入文件数: {len(code_files)}")
    print(f"清洗后总行数: {len(all_lines)}")
    print(f"写入行数: {extracted} (前段: {len(front_lines)}, 后段: {len(back_lines)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
