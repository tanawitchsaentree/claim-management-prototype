#!/usr/bin/env python3
"""human-tone sniff test — score how human a piece of writing reads, in any language.

lint.py answers one question: is this deliverable? This answers a different one: how
bad is it, where, and did the edit actually help. Use it to audit text before touching
it, and to prove a rewrite improved something instead of just moving words around.

Usage:
  python3 sniff.py article.md                 # audit a file, print a report
  cat draft.md | python3 sniff.py             # audit stdin
  python3 sniff.py --json article.md          # machine-readable
  python3 sniff.py --baseline before.md after.md   # compare two versions
  python3 sniff.py --save before.json a.md    # keep a scorecard for later
  python3 sniff.py --against before.json b.md # compare with a saved scorecard
  python3 sniff.py --quiet article.md         # score line only

Score runs 0 to 100. Higher is more human. It is a density measure: the same flaws in
a longer piece score better than in a short one, because a reader meets them less often.

Exit codes: 0 = score at or above the pass mark (default 80), 1 = below it,
2 = bad usage. --min changes the mark. Comparison mode exits 1 if the score dropped.
"""
import sys, os, re, json

sys.dont_write_bytecode = True  # never leave bytecode in an installed skill

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lint import (scan, load_profile, word_count, script_of, rhythm_units,
                  sentences, LOCKED_NOTE)

PASS_MARK = 80

# What each finding costs, per 100 words. A dash is the signature tell and costs most;
# a suspect word is a nudge. Weights are per-category so a single paragraph stuffed with
# one mistake cannot sink the score further than the mistake deserves.
WEIGHTS = {
    "dash":            14.0,
    "negation":        12.0,
    "label_colon":     10.0,
    "bowtie":          10.0,
    "fake_engagement":  9.0,
    "formula":          7.0,
    "lexicon":          5.0,
    "rhythm":           4.0,
    "anaphora":         4.0,
    "triad":            2.5,
}
# A category cannot cost more than this many points however often it repeats. Twenty
# dashes is not four times as damning as five: the reader already knows by then.
CATEGORY_CAP = 26.0
# Scaled by the category's own weight so the cap keeps the ranking rather than
# flattening it: without this a short piece pushes every category to the same ceiling
# and the report claims a suspect word is as damning as a dash. The multiplier is high
# enough that a piece riddled with one category still scores as badly as it reads.
def cap_for(code):
    return min(CATEGORY_CAP, WEIGHTS.get(code, 3.0) * 3.2)

LABELS = {
    "dash":            "em/en dashes",
    "negation":        "negation scaffolding",
    "label_colon":     "label colons",
    "bowtie":          "bow-tie endings",
    "fake_engagement": "fake engagement",
    "formula":         "formula constructions",
    "lexicon":         "AI lexicon",
    "rhythm":          "uniform rhythm",
    "anaphora":        "anaphora",
    "triad":           "rule-of-three",
}

VERDICTS = [
    (90, "reads human"),
    (75, "mostly human, a few tells"),
    (55, "smells like AI in places"),
    (35, "reads machine-written"),
    (0,  "unmistakably AI"),
]


def verdict(score, hard_count=0):
    """The label for a score. No band may call text human while a hard violation stands:
    density is forgiving by design, so one dash in a long piece scores in the eighties or
    nineties, and printing "reads human" there while lint.py fails the same text hands the
    reader a contradiction. Both top bands become a near-miss instead. The lower bands
    already read as failures, so a hard count adds nothing to them."""
    for floor, text in VERDICTS:
        if score >= floor:
            if floor >= 75 and hard_count:
                return "almost, but %d hard violation%s left" % (
                    hard_count, "" if hard_count == 1 else "s")
            return text
    return VERDICTS[-1][1]


def audit(text, profile=None):
    """Score text and return a scorecard. Pure measurement, no printing."""
    profile = profile if profile is not None else load_profile()
    hard, warn = scan(text, profile)
    words = word_count(text)
    # Short text gets a floor: one dash in a six-word line is a real tell, but dividing
    # by 0.06 hundred-words would price it at hundreds of points and tell us nothing.
    per_100 = max(words, 25) / 100.0

    counts, costs = {}, {}
    for v in hard + warn:
        code = v.get("code", "lexicon")
        counts[code] = counts.get(code, 0) + 1
    for code, n in counts.items():
        raw = WEIGHTS.get(code, 3.0) * n / per_100
        costs[code] = round(min(raw, cap_for(code)), 2)

    penalty = sum(costs.values())
    score = int(round(max(0.0, 100.0 - penalty)))

    sents, lengths = rhythm_units(re.sub(r"[ \t]+", " ", text))
    return {
        "version": 1,
        "score": score,
        "verdict": verdict(score, len(hard)),
        "pass": score >= PASS_MARK,
        "words": int(round(words)),
        "script": script_of(text),
        "hard_count": len(hard),
        "warn_count": len(warn),
        "counts": counts,
        "costs": costs,
        "worst": sorted(costs.items(), key=lambda kv: -kv[1]),
        "hard": hard,
        "warn": warn,
        "sentence_count": len(sents),
        "median_words": round(sorted(lengths)[len(lengths) // 2], 1) if lengths else 0,
        "profile_active": bool(profile.get("allow")),
        "locked": LOCKED_NOTE,
    }


def worst_lines(card, limit=3):
    """Lines carrying the most findings, so a rewrite knows where to start."""
    per_line = {}
    for v in card["hard"] + card["warn"]:
        if v["line"]:
            per_line.setdefault(v["line"], []).append(v)
    ranked = sorted(per_line.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    return ranked[:limit]


def bar(cost, worst, width=10):
    """Bars are relative to the worst category present, so the shape shows what to fix
    first. Scaling to the absolute cap would leave every bar nearly empty on good text."""
    if worst <= 0:
        return "." * width
    filled = int(round(min(cost, worst) / worst * width))
    return "#" * filled + "." * (width - filled)


def render(card, name="text"):
    out = [f"SNIFF TEST — {name}", "-" * 46,
           f"Human score   {card['score']}/100   {card['verdict']}",
           f"{card['words']} words, {card['script']} script, "
           f"{card['hard_count']} hard / {card['warn_count']} warnings"]
    # The score is density and the gate is absolute, so they legitimately disagree: one
    # dash in a long piece scores in the eighties and still fails lint.py. Say so here
    # rather than letting a reader take 85/100 as permission to ship.
    if card["hard_count"]:
        out.append("lint.py FAILS this text. Density forgives a rare flaw; the gate does "
                   "not, so a good score here is not clearance to deliver.")
    if card["worst"]:
        out.append("")
        out.append("What costs the most (per 100 words)")
        top = card["worst"][0][1]
        for code, cost in card["worst"]:
            n = card["counts"][code]
            out.append(f"  {bar(cost, top)}  {LABELS.get(code, code)}  x{n}  -{cost:g}")
    lines = worst_lines(card)
    if lines:
        out.append("")
        out.append("Worst lines")
        for lineno, hits in lines:
            rules = ", ".join(sorted({h["rule"].split(":")[0] for h in hits}))
            out.append(f"  line {lineno}: {rules}")
            out.append(f"    {hits[0]['text']}")
    if card["profile_active"]:
        out.append("")
        out.append(f"(voice profile active; {card['locked']})")
    if not card["worst"]:
        out.append("")
        out.append("Nothing flagged. Read it aloud once before shipping anyway.")
    return "\n".join(out)


def render_diff(before, after, name_a="before", name_b="after"):
    delta = after["score"] - before["score"]
    out = ["SNIFF TEST — comparison", "-" * 46,
           f"{name_a:<16} {before['score']:>3}/100  {before['verdict']}",
           f"{name_b:<16} {after['score']:>3}/100  {after['verdict']}",
           f"{'change':<16} {delta:>+4}"]

    codes = sorted(set(before["counts"]) | set(after["counts"]))
    rows = []
    for code in codes:
        b, a = before["counts"].get(code, 0), after["counts"].get(code, 0)
        if b != a:
            rows.append((LABELS.get(code, code), b, a))
    if rows:
        out.append("")
        out.append("What changed")
        for label, b, a in rows:
            mark = "fixed" if a == 0 else ("worse" if a > b else "better")
            out.append(f"  {label:<24} {b} -> {a}  {mark}")

    # survivors only: anything already named above as worse or better is not news
    unfixed = [(LABELS.get(c, c), n) for c, n in sorted(after["counts"].items())
               if n and n == before["counts"].get(c, 0)]
    if unfixed:
        out.append("")
        out.append("Untouched")
        for label, n in unfixed:
            out.append(f"  {label} x{n}")

    out.append("")
    if delta > 0 and after["pass"] and after["hard_count"]:
        out.append(f"Better, and over the line, but lint.py still fails it: "
                   f"{after['hard_count']} hard left.")
    elif delta > 0 and after["pass"]:
        out.append("Better, and over the line.")
    elif delta > 0:
        out.append(f"Better, still under {PASS_MARK}. Keep going.")
    elif delta == 0:
        out.append("No change. The edit moved words without removing patterns.")
    else:
        out.append("Worse than before. The rewrite introduced new tells.")
    return "\n".join(out)


def read_input(path):
    if path:
        try:
            with open(path, encoding="utf-8") as fh:
                return fh.read()
        except OSError as e:
            print(f"sniff: cannot read {path}: {e.strerror}", file=sys.stderr)
            sys.exit(2)
    return sys.stdin.read()


def take_value(argv, flag):
    """Pull '--flag value' out of argv, returning the value or None."""
    if flag not in argv:
        return None
    i = argv.index(flag)
    try:
        val = argv[i + 1]
    except IndexError:
        print(f"sniff: {flag} needs a value", file=sys.stderr)
        sys.exit(2)
    del argv[i:i + 2]
    return val


def load_card(path):
    try:
        with open(path, encoding="utf-8") as fh:
            card = json.load(fh)
    except (OSError, ValueError) as e:
        print(f"sniff: cannot read scorecard {path}: {e}", file=sys.stderr)
        sys.exit(2)
    if not isinstance(card, dict) or "score" not in card:
        print(f"sniff: {path} is not a scorecard", file=sys.stderr)
        sys.exit(2)
    card.setdefault("counts", {})
    card.setdefault("verdict", verdict(card["score"]))
    card.setdefault("pass", card["score"] >= PASS_MARK)
    return card


def main():
    argv = sys.argv[1:]
    as_json = "--json" in argv
    quiet = "--quiet" in argv
    no_profile = "--no-profile" in argv
    baseline = take_value(argv, "--baseline")
    against = take_value(argv, "--against")
    save = take_value(argv, "--save")
    min_raw = take_value(argv, "--min")

    mark = PASS_MARK
    if min_raw is not None:
        try:
            mark = int(min_raw)
        except ValueError:
            print("sniff: --min needs a number", file=sys.stderr)
            sys.exit(2)

    files = [a for a in argv if not a.startswith("-")]
    profile = {} if no_profile else load_profile()

    if baseline and against:
        print("sniff: use --baseline or --against, not both", file=sys.stderr)
        sys.exit(2)

    # comparison mode
    if baseline or against:
        if not files:
            print("sniff: comparison needs the newer text as a file argument",
                  file=sys.stderr)
            sys.exit(2)
        after = audit(read_input(files[0]), profile)
        after["pass"] = after["score"] >= mark
        if baseline:
            before = audit(read_input(baseline), profile)
            before["pass"] = before["score"] >= mark
            name_a = os.path.basename(baseline)
        else:
            before = load_card(against)
            name_a = os.path.basename(against)
        if as_json:
            print(json.dumps({"before": before, "after": after,
                              "delta": after["score"] - before["score"]},
                             ensure_ascii=False, indent=1))
        elif quiet:
            print(f"{before['score']} -> {after['score']}")
        else:
            print(render_diff(before, after, name_a, os.path.basename(files[0])))
        if save:
            write_card(after, save)
        sys.exit(0 if after["score"] >= before["score"] else 1)

    # single audit
    card = audit(read_input(files[0] if files else None), profile)
    card["pass"] = card["score"] >= mark
    if as_json:
        print(json.dumps(card, ensure_ascii=False, indent=1))
    elif quiet:
        print(f"{card['score']}/100 {card['verdict']}")
    else:
        print(render(card, os.path.basename(files[0]) if files else "stdin"))
    if save:
        write_card(card, save)
    sys.exit(0 if card["pass"] else 1)


def write_card(card, path):
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(card, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
    except OSError as e:
        print(f"sniff: cannot write {path}: {e.strerror}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
