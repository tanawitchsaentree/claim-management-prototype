#!/usr/bin/env python3
"""human-tone voice profile — learn a writer's real voice from their own writing.

Reads samples the user actually wrote and produces profile.json, which lint.py
then honours. The point is to stop flagging a person's genuine habits as AI
patterns while keeping the structural bans intact.

Usage:
  python3 voice_profile.py sample1.md sample2.md          # write profile.json beside this script
  python3 voice_profile.py --dir ~/writing               # every .md/.txt in a folder
  python3 voice_profile.py --out /tmp/p.json samples/*   # explicit destination
  python3 voice_profile.py --show                        # print the active profile

What it can relax: lexicon items and rhythm thresholds. A word has to appear in
at least two separate samples to count as the writer's own, so one stray
"seamless" does not unban it.

What it can never relax (LOCKED): dashes, negation scaffolding, label colons,
fake engagement, bow-tie endings. Those structures are the skill's whole
purpose. A profile that could switch them off would just be an off switch.
"""
import sys, os, re, json, glob

# importing lint would otherwise leave __pycache__ in the user's skill folder. An
# installed skill should hold only the files it was installed with.
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.join(HERE, "profile.json")

sys.path.insert(0, HERE)
from lint import (LEX_HARD_EN, LEX_HARD_TH, LEX_HARD_CJK, LEX_WARN, rhythm_units,
                  strip_code_and_urls, fenced_lines, LOCKED_NOTE)

# Lexicon is taste and can be personal. Structure is the product.
RELAXABLE = set(w.lower() for w in LEX_HARD_EN + LEX_HARD_TH + LEX_HARD_CJK + LEX_WARN)

CONTRACTION = re.compile(r"\b\w+'(s|t|re|ve|ll|d|m)\b", re.I)
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
DASH_ANY = re.compile(r"[—–]|\s--\s")


def read_samples(paths):
    out = []
    for p in paths:
        try:
            with open(p, encoding="utf-8") as fh:
                text = fh.read()
        except OSError as e:
            print(f"profile: skipping {p}: {e.strerror}", file=sys.stderr)
            continue
        if text.strip():
            out.append((p, text))
    return out


def prose_of(text):
    """Drop code fences, inline code and URLs, the way lint.py does."""
    lines = text.splitlines()
    skip = fenced_lines(lines)
    keep = [strip_code_and_urls(ln) for i, ln in enumerate(lines, 1) if i not in skip]
    return "\n".join(keep)


def measure(samples):
    per_sample_hits = {}
    all_lengths = []
    contractions = emoji = dashes = 0

    for path, raw in samples:
        text = prose_of(raw)
        low = text.lower()
        for w in RELAXABLE:
            if w in low or w in text:
                per_sample_hits.setdefault(w, set()).add(path)
        # measured the way lint.py measures, so a profile built from Thai or Japanese
        # samples describes the same units the linter will check against
        _, lens = rhythm_units(re.sub(r"[ \t]+", " ", text))
        all_lengths.extend(lens)
        contractions += len(CONTRACTION.findall(text))
        emoji += len(EMOJI.findall(text))
        dashes += len(DASH_ANY.findall(text))

    # a habit needs to show up in two separate samples to count as voice
    allow = sorted(w for w, seen in per_sample_hits.items() if len(seen) >= 2)
    single = sorted(w for w, seen in per_sample_hits.items() if len(seen) == 1)

    lengths = sorted(n for n in all_lengths if n)
    rhythm = {}
    if lengths:
        mid = lengths[len(lengths) // 2]
        short = sum(1 for n in lengths if n <= 6) / len(lengths)
        rhythm = {
            "median_sentence_words": round(mid, 1),
            "short_sentence_ratio": round(short, 3),
            # someone who genuinely writes long gets more rope before the
            # uniform-rhythm warning fires
            "uniform_run_allowance": 4 if mid >= 20 else 3,
            "expects_short_sentences": short >= 0.08,
        }

    return {
        "version": 1,
        "samples": [os.path.basename(p) for p, _ in samples],
        "sample_count": len(samples),
        "allow": allow,
        "seen_once_not_allowed": single,
        "rhythm": rhythm,
        "habits": {
            "uses_contractions": contractions >= max(3, len(samples)),
            "emoji_per_sample": round(emoji / len(samples), 2) if samples else 0,
            "dashes_found": dashes,
        },
        "locked": LOCKED_NOTE,
    }


def main():
    argv = sys.argv[1:]
    if "--show" in argv:
        if not os.path.exists(DEFAULT_OUT):
            print("no profile yet. Run: python3 scripts/voice_profile.py <your-writing>...")
            sys.exit(1)
        with open(DEFAULT_OUT, encoding="utf-8") as fh:
            print(fh.read())
        return

    out = DEFAULT_OUT
    if "--out" in argv:
        i = argv.index("--out")
        try:
            out = argv[i + 1]
        except IndexError:
            print("profile: --out needs a path", file=sys.stderr)
            sys.exit(2)
        del argv[i:i + 2]

    paths = []
    if "--dir" in argv:
        i = argv.index("--dir")
        try:
            d = argv[i + 1]
        except IndexError:
            print("profile: --dir needs a path", file=sys.stderr)
            sys.exit(2)
        del argv[i:i + 2]
        for ext in ("md", "txt", "markdown"):
            paths += sorted(glob.glob(os.path.join(os.path.expanduser(d), f"**/*.{ext}"),
                                      recursive=True))
    paths += [p for p in argv if not p.startswith("-")]

    if not paths:
        print(__doc__.strip().split("\n\nUsage:")[0], file=sys.stderr)
        print("\nprofile: give me files you wrote, or --dir a folder of them", file=sys.stderr)
        sys.exit(2)

    samples = read_samples(paths)
    if len(samples) < 2:
        print(f"profile: got {len(samples)} readable sample(s). Two or more is the point: "
              "a habit has to repeat before it counts as voice.", file=sys.stderr)
        sys.exit(2)

    prof = measure(samples)
    try:
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(prof, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
    except OSError as e:
        print(f"profile: cannot write {out}: {e.strerror}", file=sys.stderr)
        sys.exit(2)

    print(f"profile written to {out} from {prof['sample_count']} samples")
    if prof["allow"]:
        print(f"  your words, no longer flagged: {', '.join(prof['allow'])}")
    if prof["seen_once_not_allowed"]:
        print(f"  seen once, still flagged: {', '.join(prof['seen_once_not_allowed'])}")
    r = prof["rhythm"]
    if r:
        print(f"  your rhythm: median {r['median_sentence_words']} words, "
              f"{int(r['short_sentence_ratio'] * 100)}% short sentences")
    if prof["habits"]["dashes_found"]:
        print(f"  found {prof['habits']['dashes_found']} pause dashes in your own writing. "
              "Still banned: that is the one habit this skill exists to break.")


if __name__ == "__main__":
    main()
