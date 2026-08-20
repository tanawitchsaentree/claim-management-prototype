#!/usr/bin/env python3
"""human-tone lint — deterministic tone gate.

Usage:
  python3 lint.py draft.md            # scan a file
  cat draft.md | python3 lint.py      # scan stdin
  python3 lint.py --json draft.md     # machine-readable output
  python3 lint.py --no-profile x.md   # ignore the writer profile

Exit codes: 0 = clean (deliverable), 1 = hard violations found, 2 = bad usage.
No dependencies. Python 3.8+. Runs in milliseconds.

If profile.json sits beside this script (written by profile.py), the writer's own
lexicon and rhythm are honoured. The structural bans never relax; see LOCKED_NOTE.
"""
import sys, re, json, os

# Structures a profile can never switch off. Lexicon is taste; these are the product.
LOCKED_NOTE = ("dashes, negation scaffolding, label colons, fake engagement and "
               "bow-tie endings stay banned regardless of profile")

# ---------- pattern tables ----------
DASH = [(re.compile(r"[\u2014\u2013]"), "pause dash (em/en)"),
        (re.compile(r"\s--\s"), "double-hyphen pause dash")]

NEGATION = [
    re.compile(r"\bnot (just|only|merely|simply)\b", re.I),
    re.compile(r"\bisn'?t (just|only|about)\b", re.I),
    re.compile(r"\bit'?s not about\b", re.I),
    re.compile(r"\bmore than just\b", re.I),
    re.compile(r"\bless about\b.{0,40}\bthan\b", re.I),
    re.compile(r"ไม่ใช่แค่"), re.compile(r"ไม่เพียง"), re.compile(r"ไม่ใช่เรื่อง"),
    # Japanese: 単に/だけでなく/ではなく carry the same "not merely X but Y" shape
    re.compile(r"単に.{0,30}(ではなく|ではありません)"),
    re.compile(r"だけでなく"), re.compile(r"のみならず"),
    re.compile(r"(?:こと|もの|問題|話)ではなく"),
    # Chinese
    re.compile(r"不仅(?:仅)?"), re.compile(r"不只是"), re.compile(r"而不是"),
    # Korean
    re.compile(r"뿐만 아니라"), re.compile(r"단순히.{0,20}아니"),
]

LEX_HARD_EN = ["delve", "seamless", "seamlessly", "leverage", "unlock", "empower",
    "elevate", "supercharge", "streamline", "harness", "foster", "tapestry",
    "testament", "game-changer", "game changer", "transformative", "revolutionize",
    "cutting-edge", "in today's fast-paced", "dive into", "deep dive",
    "it's worth noting", "it goes without saying", "utilize", "at its core",
    "when it comes to", "that being said", "needless to say", "here's the kicker",
    "look no further", "let's dive in", "buckle up", "let that sink in",
    "pro tip:", "chef's kiss", "double-edged sword", "robust"]
LEX_HARD_TH = ["ในยุคที่", "เรียกได้ว่า", "อย่างที่ทราบกันดี", "ปลดล็อกศักยภาพ",
    "กล่าวโดยสรุป", "จะเห็นได้ว่า"]
# The same marketing register in CJK. Structures are caught by the pattern tables;
# these are the fixed phrases that survive translation unchanged.
LEX_HARD_CJK = [
    "急速に変化する", "最先端", "シームレス", "活用し", "実現します", "向上させ",
    "潜在能力", "革新的", "であることの証",
    "日新月异", "赋能", "无缝", "释放潜力", "革命性", "引领",
    "빠르게 변화하는", "최첨단", "잠재력을 발휘",
]
LEX_WARN = ["crucial", "vital", "journey", "landscape", "navigate",
    "ทั้งนี้", "นั่นเอง", "เลยทีเดียว", "ตอบโจทย์", "ยกระดับ", "อีกทั้งยัง", "อีกด้วย"]

FORMULA = [
    re.compile(r"\bThe (result|best part|answer|kicker)\?", re.I),
    re.compile(r"^\s*Enter [A-Z]", re.M),
    re.compile(r"\bIt'?s simple:", re.I),
    re.compile(r"\bNot gonna lie\b", re.I),
    re.compile(r"คำตอบคือ"), re.compile(r"บอกเลยว่า"),
]

BOWTIE = [re.compile(p, re.I) for p in
    [r"\bIn conclusion\b", r"\bUltimately,", r"\bAt the end of the day\b",
     r"สุดท้ายนี้", r"ทั้งหมดนี้ก็เพื่อ",
     r"結論として", r"最後に、", r"と言えるだろう", r"の証である", r"ではないだろうか",
     r"总而言之", r"综上所述", r"归根结底",
     r"결론적으로", r"결국"]]

# label colon: short label + ':' + content. Skips times, ratios, URLs, code.
# Emphasis markers are stripped first so "**Speed:** we move fast" is caught too.
COLON = re.compile(r"(?<![0-9])(?<!:):(?![0-9/:])\s+\S")
COLON_OK = re.compile(r"^\s*(https?://|\||\d)")
INLINE_CODE = re.compile(r"`[^`]*`")
URL = re.compile(r"https?://\S+")
EMPHASIS = re.compile(r"\*\*|__|\*|_")
FENCE = re.compile(r"^\s*(```|~~~)")

def strip_code_and_urls(line):
    return URL.sub("", INLINE_CODE.sub("", line))

def fenced_lines(lines):
    """1-based line numbers sitting inside (or on) a fenced code block."""
    inside, marked = False, set()
    for i, ln in enumerate(lines, 1):
        if FENCE.match(ln):
            marked.add(i)
            inside = not inside
            continue
        if inside:
            marked.add(i)
    return marked

FAKE = [re.compile(p, re.I) for p in
    [r"\bI hope this helps\b", r"\bFeel free to\b", r"\bGreat question\b",
     r"\bDon'?t hesitate\b", r"\bThank you for your attention\b",
     r"\bLet'?s (face it|be honest|be real)\b",
     r"\bWe'?ve all (been there|felt)\b",
     r"\bSound familiar\b", r"\bAm I right\b",
     r"ลองคิดดูสิ", r"เชื่อไหมว่า", r"ว่าไหม(ล่ะ|ครับ|คะ)?\s*[?？]",
     r"正直に言うと", r"ですよね[?？]", r"不觉得", r"그렇지 않나요"]]

# A rhetorical question is a structure, not a phrase, so a phrase list will always
# be one paraphrase behind. Both of these caught nothing before: a Haiku-written
# LinkedIn post opened with "You know that feeling when text feels stiff? Generic?
# Like it rolled out of a chatbot?" and scored a clean 100.
#
# voice.md deliberately allows ONE self-question answered immediately, which is a
# real human move ("So what do you do? You put something real in front of people").
# So neither rule can simply ban question marks. Instead:
#   1. a question in the opening position, where nobody has asked anything yet
#   2. question marks stacked back to back, which is the performed-curiosity tic
#
# Interrogatives that a reader could actually be asking are exempt in the opener
# check, since a document may legitimately open by naming the question it answers
# ("What does it cost? About 84 KB.") — that is the allowed self-question, and the
# stacking rule below still catches the version that piles three of them up.
QUESTION_OPENER = [re.compile(p, re.I) for p in
    [r"^\s*(Ever|Have you ever)\b[^.!?]*\?",
     r"^\s*(You know|Do you know|Did you know)\b[^.!?]*\?",
     r"^\s*(Ready|Wondering|Curious|Tired of|Struggling)\b[^.!?]*\?",
     r"^\s*(What if|Imagine)\b[^.!?]*\?",
     r"^\s*(Sound|Sounds) (familiar|about right)\b",
     r"^\s*เคย[^.!?]*ไหม",
     r"^\s*(รู้|ทราบ)ไหม",
     r"^\s*เคยสงสัย",
     r"^\s*(ご存知|知っています)",
     r"^\s*(你知道|您是否)",
     r"^\s*(혹시|알고 계셨)"]]

# Two or more question marks in a row across short stretches. "Generic? Like a
# chatbot wrote it?" is the shape: a real question followed by fragments dressed as
# questions, which is a model performing engagement rather than asking anything.
QUESTION_STACK = re.compile(r"\?[^?]{0,60}\?")

TRIAD = re.compile(r"\b(\w{3,}), (\w{3,}),? and (\w{3,})\b")

THAI_CH = re.compile(r"[\u0e00-\u0e7f]")
CJK_CH = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]")

# Thai, Japanese, Chinese and Korean do not put spaces between words, so counting
# whitespace tokens there returns nonsense. These divisors turn characters into
# word-equivalents so length and rhythm compare across scripts. They are estimates,
# used only for ratios, and never reported to anyone as a word count.
THAI_CHARS_PER_WORD = 4.0
CJK_CHARS_PER_WORD = 1.7

def is_thai(text):
    th = len(THAI_CH.findall(text))
    return th > len(text) * 0.25

def script_of(text):
    """Dominant script, which decides how length and rhythm get measured."""
    if not text:
        return "latin"
    n = len(text)
    if len(THAI_CH.findall(text)) > n * 0.25:
        return "thai"
    if len(CJK_CH.findall(text)) > n * 0.25:
        return "cjk"
    return "latin"

def word_count(text):
    """Length in word-equivalents, whatever the script. Equals the whitespace token
    count for spaced scripts, so nothing changes for English."""
    thai = len(THAI_CH.findall(text))
    cjk = len(CJK_CH.findall(text))
    spaced = THAI_CH.sub(" ", CJK_CH.sub(" ", text))
    return len(spaced.split()) + thai / THAI_CHARS_PER_WORD + cjk / CJK_CHARS_PER_WORD

def sentences(text):
    """Split into sentences. A Latin full stop needs whitespace after it; the CJK
    ones do not, since those scripts run sentences together without spacing."""
    parts = []
    for chunk in re.split(r"(?<=[\u3002\uff01\uff1f\uff1b])", text):
        parts.extend(re.split(r"(?<=[.!?])\s+", chunk))
    return [s.strip() for s in parts if s.strip()]

def rhythm_units(text):
    """The stretches whose rhythm a reader feels, and their word-equivalent lengths.
    Returns them together so callers cannot pair a length with the wrong stretch.

    Thai writes no sentence-final punctuation, so a whole paragraph comes back as a
    single sentence and every rhythm check sees one long blur. In Thai a space marks
    a clause break, which is the unit that carries rhythm there, so use those when
    punctuation is clearly not doing the work.
    """
    sents = sentences(text)
    if script_of(text) == "thai":
        units = word_count(text)
        # count real terminators, not split parts: text with none at all still comes
        # back from sentences() as one piece, which would look like a single sentence
        # rather than the unpunctuated paragraph it is
        stops = len(re.findall(r"[.!?。！？]", text))
        if units and stops / units < 0.02:  # under one stop per 50 words
            sents = [s for s in re.split(r"\s+", text) if s.strip()]
    return sents, [word_count(s) for s in sents]

def load_profile(path=None):
    """Read profile.json if present. Absent or unreadable means default behaviour."""
    p = path or os.path.join(os.path.dirname(os.path.abspath(__file__)), "profile.json")
    try:
        with open(p, encoding="utf-8") as fh:
            prof = json.load(fh)
    except (OSError, ValueError):
        return {}
    return prof if isinstance(prof, dict) else {}

def scan(text, profile=None):
    profile = profile or {}
    allow = set(w.lower() for w in profile.get("allow", []) if isinstance(w, str))
    rhythm = profile.get("rhythm") or {}
    run_limit = rhythm.get("uniform_run_allowance", 3)
    if not isinstance(run_limit, int) or run_limit < 3:
        run_limit = 3
    hard, warn = [], []
    lines = text.splitlines()
    thai = is_thai(text)

    def hit(bucket, lineno, rule, frag, code):
        bucket.append({"line": lineno, "rule": rule, "code": code,
                       "text": frag.strip()[:80]})

    skip = fenced_lines(lines)

    for i, ln in enumerate(lines, 1):
        if i in skip: continue
        prose = strip_code_and_urls(ln)
        low = prose.lower()
        for rx, name in DASH:
            if rx.search(prose): hit(hard, i, name, ln, "dash")
        for w in LEX_HARD_EN:
            if w in low and w not in allow: hit(hard, i, f"banned word: {w}", ln, "lexicon")
        for w in LEX_HARD_TH + LEX_HARD_CJK:
            if w in prose and w not in allow: hit(hard, i, f"banned word: {w}", ln, "lexicon")
        for w in LEX_WARN:
            if w in allow: continue
            if (w in low) or (w in prose): hit(warn, i, f"suspect word: {w}", ln, "lexicon")
        for rx in FORMULA:
            if rx.search(prose): hit(hard, i, "formula construction", ln, "formula")
        for rx in FAKE:
            if rx.search(prose): hit(hard, i, "fake engagement", ln, "fake_engagement")
        m = TRIAD.search(prose)
        if m: hit(warn, i, "possible rule-of-three", ln, "triad")
        # emphasis stripped so "**Speed:** we move fast" reads as "Speed: we move fast"
        if COLON.search(EMPHASIS.sub("", prose)) and not COLON_OK.search(prose):
            hit(hard, i, "label colon in prose", ln, "label_colon")

    # negation scaffolds: 1 = verify strawman, 2+ = hard fail
    neg = []
    for i, ln in enumerate(lines, 1):
        if i in skip: continue
        for rx in NEGATION:
            if rx.search(ln): neg.append((i, ln))
    if len(neg) >= 2:
        for i, ln in neg:
            hit(hard, i, "negation scaffold (over the 1-per-doc ceiling)", ln, "negation")
    elif len(neg) == 1:
        hit(warn, neg[0][0], "one contrast found: verify it passes the strawman test",
            neg[0][1], "negation")

    # Rhetorical questions. Two separate shapes, deliberately narrow, because voice.md
    # allows one genuine self-question answered immediately and that must keep passing.
    #
    # Shape 1: an opener. The tell is position, not wording: at the top of a piece
    # nobody has asked the writer anything, so a question there is manufacturing an
    # interest the reader has not shown. Only the first paragraph is checked.
    first_para_end = 0
    for i, ln in enumerate(lines, 1):
        if not ln.strip() and i > 1:
            break
        first_para_end = i
    for i, ln in enumerate(lines, 1):
        if i > first_para_end or i in skip:
            continue
        prose = strip_code_and_urls(ln)
        for rx in QUESTION_OPENER:
            if rx.search(prose):
                hit(hard, i, "rhetorical question opener", ln, "fake_engagement")
                break

    # Shape 2: stacked question marks anywhere. One self-question is a human move;
    # three in a row is performed curiosity. Counted per paragraph so a long document
    # with one question in each section does not accumulate a false positive.
    for para in [p for p in text.split("\n\n") if p.strip()]:
        prose = strip_code_and_urls(re.sub(r"[ \t]+", " ", para.replace("\n", " ")))
        if QUESTION_STACK.search(prose):
            # locate the paragraph's first line for the report
            frag = next((l for l in para.splitlines() if l.strip()), para)
            lineno = next((n for n, l in enumerate(lines, 1) if l == frag), 0)
            if lineno not in skip:
                hit(hard, lineno, "stacked rhetorical questions", frag,
                    "fake_engagement")

    # bow-tie: only the last ~2 paragraphs matter
    paras = [p for p in text.split("\n\n") if p.strip()]
    tail_lines = "\n\n".join(paras[-2:]).count("\n") + 1 if paras else 0
    for i, ln in enumerate(lines, 1):
        if i <= len(lines) - tail_lines or i in skip: continue
        for rx in BOWTIE:
            if rx.search(ln): hit(hard, i, "bow-tie ending", ln, "bowtie")

    # Rhythm, measured in word-equivalents so it works in any script. Thai and CJK
    # get their length from character counts; see word_count and rhythm_units.
    flat = re.sub(r"[ \t]+", " ", text)
    sents, lengths = rhythm_units(flat)
    runs = 0
    for n, s in zip(lengths, sents):
        runs = runs + 1 if 15 <= n <= 25 else 0
        if runs == run_limit:
            hit(warn, 0, f"{run_limit} consecutive 15-25 word stretches (uniform rhythm)",
                s, "rhythm")
            runs = 0
    # short-sentence coverage per ~150-word window. A writer whose own samples
    # never lean on short sentences does not get nagged about missing them.
    wants_short = rhythm.get("expects_short_sentences", True)
    words, has_short = 0, False
    for n, s in zip(lengths, sents):
        words += n
        has_short = has_short or n <= 6
        if words >= 150:
            if not has_short and wants_short:
                hit(warn, 0, "150-word stretch with nothing under 7 words", s, "rhythm")
            words, has_short = 0, False
    # anaphora: 3 sentences opening the same way. Thai has no spaces between words,
    # so compare opening characters there instead of the first whitespace token.
    if script_of(text) == "thai":
        opens = [s[:5] for s in sents if len(s) >= 5]
    else:
        opens = [s.split()[0].lower().strip('",\'(') for s in sents if s.split()]
    for j in range(len(opens) - 2):
        if opens[j] == opens[j+1] == opens[j+2]:
            hit(warn, 0, f"anaphora: 3 sentences open with '{opens[j]}'", "", "anaphora")
            break
    return hard, warn

def main():
    flags = {"--json", "--no-profile"}
    args = [a for a in sys.argv[1:] if a not in flags]
    as_json = "--json" in sys.argv
    profile = {} if "--no-profile" in sys.argv else load_profile()
    if args:
        try:
            text = open(args[0], encoding="utf-8").read()
        except OSError as e:
            print(f"lint: cannot read {args[0]}: {e.strerror}", file=sys.stderr)
            sys.exit(2)
    else:
        text = sys.stdin.read()
    hard, warn = scan(text, profile)
    if as_json:
        print(json.dumps({"hard": hard, "warn": warn, "pass": not hard,
                          "profile": profile.get("samples", [])},
                         ensure_ascii=False, indent=1))
    else:
        for v in hard: print(f"HARD  line {v['line']:>4}  {v['rule']}  |  {v['text']}")
        for v in warn: print(f"warn  line {v['line']:>4}  {v['rule']}  |  {v['text']}")
        print(f"\n{'FAIL' if hard else 'PASS'} — {len(hard)} hard, {len(warn)} warnings")
        if profile.get("allow"):
            print(f"(profile active from {profile.get('sample_count', '?')} samples; "
                  f"{LOCKED_NOTE})")
        if hard: print("Fix by restructuring the thought. A paragraph that fails twice gets rewritten from the idea.")
    sys.exit(1 if hard else 0)

if __name__ == "__main__":
    main()
