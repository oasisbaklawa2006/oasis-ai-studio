#!/usr/bin/env python3
"""Negative and positive tests for the one-time, blob-pinned Core #493 refresh.

Runs with a disposable local Git history: no network, Supabase, or production access.
"""
from __future__ import annotations

import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
PATH = "supabase/functions/_shared/erpInboxBridge/processErpInboundRow.ts"
GUARD = "scripts/check-core-backend-authority.sh"
OLD_COMMIT = "abeec87d9ca83ec91e78ba94ad554113d1d4c6e1"
OLD_BLOB = "911461b637413f3525f04ebcb3b565ea2d670e8f"
NEW_BLOB = "216a3aec29b8b66caccd2c45a83c40a1747a9345"


def command(repo: pathlib.Path, *args: str, input_bytes: bytes | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        list(args), cwd=repo, input=input_bytes, capture_output=True, check=False,
    )


def must(repo: pathlib.Path, *args: str) -> bytes:
    result = command(repo, *args)
    if result.returncode:
        raise AssertionError(f"{' '.join(args)}: {result.stderr.decode(errors='replace')}")
    return result.stdout


def write(repo: pathlib.Path, path: str, content: bytes) -> None:
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)


def blob(repo: pathlib.Path, content: bytes) -> str:
    result = command(repo, "git", "hash-object", "--stdin", input_bytes=content)
    if result.returncode:
        raise AssertionError(result.stderr.decode(errors="replace"))
    return result.stdout.decode().strip()


original = must(ROOT, "git", "show", f"{OLD_COMMIT}:{PATH}")
approved = (ROOT / PATH).read_bytes()
guard = (ROOT / GUARD).read_bytes()
assert blob(ROOT, original) == OLD_BLOB, "historical Studio blob changed"
assert blob(ROOT, approved) == NEW_BLOB, "proposed Studio copy differs from merged Core #493"


def scenario(name: str, must_pass: bool) -> None:
    with tempfile.TemporaryDirectory(prefix="core493-guard-") as folder:
        repo = pathlib.Path(folder)
        must(repo, "git", "init", "-q")
        must(repo, "git", "config", "user.email", "ci@example.invalid")
        must(repo, "git", "config", "user.name", "CI Guard")
        old = original + (b"\n// altered historical source\n" if name == "wrong_old_blob" else b"")
        write(repo, PATH, old)
        write(repo, GUARD, guard)
        extra = "supabase/functions/legacy-example/index.ts"
        if name == "change_existing_other":
            write(repo, extra, b"export const version = 1;\n")
        must(repo, "git", "add", "-A")
        must(repo, "git", "commit", "-qm", "historical base")
        base = must(repo, "git", "rev-parse", "HEAD").decode().strip()
        newer = approved + (b"\n// unauthorized appended code\n" if name == "wrong_new_blob" else b"")
        write(repo, PATH, newer)
        if name == "change_existing_other":
            write(repo, extra, b"export const version = 2;\n")
        if name == "add_other":
            write(repo, "supabase/functions/unapproved-worker/index.ts", b"export {};\n")
        if name == "rename_core":
            renamed = repo / "supabase/functions/_shared/erpInboxBridge/renamed.ts"
            (repo / PATH).rename(renamed)
        must(repo, "git", "add", "-A")
        must(repo, "git", "commit", "-qm", "candidate sync")
        if name == "untracked_other":
            write(repo, "supabase/functions/untracked-worker/index.ts", b"export {};\n")
        check = command(repo, "bash", GUARD, base)
        accepted = check.returncode == 0
        if accepted != must_pass:
            raise AssertionError(
                f"{name}: expected {'PASS' if must_pass else 'REJECT'}, "
                f"got {check.returncode}\nstdout={check.stdout.decode()}\n"
                f"stderr={check.stderr.decode()}"
            )
        print(f"PASS {name}: {'admitted' if accepted else 'correctly rejected'}")


scenario("exact_core493_blob", must_pass=True)
for negative in (
    "wrong_old_blob",
    "wrong_new_blob",
    "change_existing_other",
    "add_other",
    "rename_core",
    "untracked_other",
):
    scenario(negative, must_pass=False)
print("One-time Core #493 snapshot provenance gate: all 7 scenarios passed.")
