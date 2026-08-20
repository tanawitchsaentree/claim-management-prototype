# Banlist: AI patterns to detect and remove

Each pattern below is defined by STRUCTURE first, then surface examples. When writing in a language not shown here, map the structure into that language and apply the same ban. The structure is the pattern. The words are just its costume.

Priority order when scanning: sections 1 and 2 are zero-tolerance. Everything else is strong-avoid.

---

## 1. Dashes (zero tolerance)

Ban: em dash (—), en dash used as a pause (–), and double hyphen (--) used the same way.

Why it fails: the dash lets the writer bolt a flourish onto a sentence. Models do it constantly; careful human writers do it rarely.

Fix by restructuring, not deleting:

- BAD: "The pipeline was fast — three months of work done in two weeks."
- STILL BAD (dash removed, rhythm kept): "The pipeline was fast, three months of work done in two weeks."
- GOOD: "The pipeline cut three months of work down to two weeks."

Hyphens inside compound words (design-to-deploy, ตัวเลข 3-5) are fine. This ban is about the pause-dash only.

## 2. Contrastive negation scaffolding (zero tolerance)

Structure: defining a thing by first negating something nobody claimed. The sentence spends half its length on what the thing is NOT.

Surface forms, English: "X, not Y" / "not X but Y" / "It's not just X, it's Y" / "This isn't about X, it's about Y" / "not only X but also Y" / "less X than Y" / "more than just X" / "rather than X, we Y" (when used as a reflex, not a real comparison).

Surface forms, Thai: "ไม่ใช่แค่ X แต่คือ Y" / "ไม่เพียงแต่ X แต่ยัง Y" / "ไม่ใช่เรื่องของ X แต่เป็นเรื่องของ Y" / "X ต่างหาก ไม่ใช่ Y".

Fix: state the positive claim. If the reader genuinely holds the wrong belief, name that belief in its own sentence with real content, then correct it.

- BAD: "Design is not about making things pretty, it's about solving problems."
- GOOD: "Design is problem solving. The visuals are the last ten percent."
- BAD (Thai): "งานนี้ไม่ใช่แค่การออกแบบหน้าจอ แต่คือการออกแบบระบบ"
- GOOD (Thai): "งานนี้คือการออกแบบระบบทั้งตัว หน้าจอเป็นแค่ปลายทาง"

**The strawman test.** Ask of every contrast: was the negated half ever a real belief, a real objection, or a real prior state? If nobody believed it, the contrast is scaffolding. Cut it and state the positive claim. If it names something real being overturned, it carries information and humans genuinely write it:

- PASSES: "The award went to the app, not to me personally." (real correction)
- PASSES: "Design was a want, not a need. That changed." (real prior state, real claim)
- FAILS: "This isn't just a design system, it's a philosophy." (nobody claimed it was just a design system)

Ceiling: one earned contrast per document. Two reads as a rhetorical habit, and the habit is the tell.

## 3. Rule of three

Structure: exactly three parallel items used for rhythm rather than content. "fast, clear, and honest" / "we plan, we build, we ship" / Thai: "เร็ว ชัด และจริงใจ".

Fix: use two, or use a real list of however many items actually exist. If three things genuinely exist, break the parallelism so they don't chant.

## 4. Anaphora and parallel openers

Structure: consecutive sentences or bullets opening with the same word or same grammatical shape. "You'll own... You'll shape... You'll drive..." Models produce this under any instruction to be punchy.

Fix: vary openers naturally. Merge two of the sentences. Turn one into a subordinate clause.

## 5. AI lexicon

English (ban outright): delve, seamless, seamlessly, robust, leverage (as a verb), unlock, empower, elevate, supercharge, streamline, harness, foster, navigate (metaphorical), journey (metaphorical), landscape (metaphorical), tapestry, testament, game-changer, transformative, revolutionize, cutting-edge, "in today's fast-paced world", "dive into", "deep dive", "it's worth noting", "it goes without saying", crucial, vital (when "important" would do), utilize (use "use"), "at its core", "when it comes to", "in the world of", "that being said", "needless to say", "the key is", "here's the kicker", "look no further", "let's dive in", "buckle up", "let that sink in", "pro tip:", "spoiler:", "chef's kiss", "double-edged sword", "whether you're a beginner or a pro" (and every "whether you're X or Y" audience-flattening).

Thai (ban outright): "ในยุคที่..." as an opener, "เรียกได้ว่า", "ถือเป็น...อย่างหนึ่ง", "อย่างไรก็ตาม" as paragraph glue more than once per document, "ไม่ว่าจะเป็น... หรือ..." as filler listing, "อีกทั้งยัง", "ตอบโจทย์" when overused, "ทั้งนี้" as sentence glue, "อย่างที่ทราบกันดี", "จะเห็นได้ว่า", "กล่าวโดยสรุป", "นั่นเอง" as a sentence closer, "เลยทีเดียว", "อีกด้วย" more than once per document, "ในส่วนของ...นั้น", direct calques from English AI text ("ปลดล็อกศักยภาพ", "ยกระดับ" as a reflex).

Other languages: the equivalents exist everywhere (German "nahtlos", Japanese 「シームレス」「活用」reflexes). If a word appears in every AI-generated text in that language and rarely in human chat, treat it as banned.

## 6. Bow-tie endings

Structure: a final paragraph or sentence that summarizes what was just said, zooms out to a life lesson, or applies a motivational coat. "Ultimately, ..." / "In conclusion, ..." / "By following these steps, you'll be well on your way to..." / Thai: "สุดท้ายนี้...", "ทั้งหมดนี้ก็เพื่อ...".

Fix: delete the closer. End on the last sentence that contains information. It will feel abrupt to you and normal to the reader.

## 7. Fake engagement

- Rhetorical question openers ("Ever wondered why...?", "เคยสงสัยไหมว่า...")
- Stacked questions, where a real question is followed by fragments dressed as questions ("You know that feeling when text reads stiff? Generic? Like a chatbot wrote it?")
- "Let's face it", "Let's be honest"
- Mirroring the request back before answering ("You're asking about X. Great question.")
- Service-voice closers: "I hope this helps", "Feel free to reach out", "Don't hesitate to"
- Thanking the reader for their attention.

Fix: start with the answer. End with the last useful fact.

The two question shapes are banned by POSITION and by COUNT, not by punctuation, because one self-question answered immediately is a real human move that `references/voice.md` deliberately allows. A question in the opening position manufactures an interest the reader has not shown, since nobody has asked the writer anything yet. Stacked question marks perform curiosity instead of asking something.

- BAD: "Ever wondered why your drafts read like a press release? Here is the fix."
- BAD: "Tired of tools that promise this? Sound familiar?"
- GOOD: "Most drafts read like a press release because of the dashes."
- GOOD (the allowed self-question): "So what do you do? You put something real in front of people and watch what they hit first."
- GOOD (opening by naming the question it answers): "What does it cost? About 84 KB, and no dependencies."

## 8. Hedging stacks and overclaiming

Structure: multiple softeners on one claim ("It's arguably worth noting that this could potentially...") or inflated certainty ("This will revolutionize...").

Fix: pick a confidence level and say it once. "I think this is wrong" or "This is wrong". Not both, not neither.

## 9. Uniform rhythm

Detection: read three consecutive sentences. If they are all 15 to 25 words, all grammatically complete, all medium-complexity, the text will scan as generated even with clean vocabulary.

Fix: vary sentence length aggressively. Include at least one very short sentence per paragraph of any length. Fragments are legal. Starting with And, But, So is legal.

## 10. Formatting tells

- Emoji as decoration or section markers.
- Bold-term-colon bullets ("**Speed:** we move fast") repeated down a list.
- Headers on short texts. Anything under a page rarely needs headers.
- "Title: Subtitle" naming pattern applied to everything.
- Numbered lists for things that are not sequences.

Fix: prose asks get prose. Save structure for genuinely structured content.

## 11. Label colons

Structure: a short label, a colon, then the content it announces. Models produce this constantly because it looks organized. It reads as a slide deck talking, and once you notice it you cannot unsee it.

- BAD: "Before AI: a few builders. After AI: an ocean of them."
- GOOD: "Before AI there were a few builders. Now there is an ocean of them."
- BAD: "**Speed:** we ship in days."
- GOOD: "We ship in days."
- BAD: "The problem: nobody read the docs."
- GOOD: "Nobody read the docs."
- BAD (Thai): "สรุป: ทีมต้องรอ engineer ทุกครั้ง"
- GOOD (Thai): "สรุปคือทีมต้องรอ engineer ทุกครั้ง"

Fix: turn the label into the subject of a sentence, or split into two sentences. If the colon is doing real work, a sentence can do the same work with better rhythm.

Colons that survive: clock times (14:30), ratios (3:1), code, URLs, citations, and dialogue scripts where a speaker is named.

## 12. The politeness crust (chat and email specific)

- Opening with "Certainly!", "Absolutely!", "Of course!"
- Apologizing before disagreeing.
- "Thank you for..." openers in emails that don't need them.
- Thai: "ครับ/ค่ะ" on every single sentence reads as scripted; natural Thai drops it after establishing register.

## 13. Formula constructions

Structure: fill-in-the-blank rhetorical templates that models reach for when told to be engaging. Each one is fine the first time a human invented it and a tell the millionth time a model reuses it.

- "The result? X." / "The best part? X." (fragment-question then answer)
- "Enter X." as a way to introduce anything
- "Think: X, Y, Z" as fake concreteness
- "Not gonna lie, ..." as an authenticity opener
- "It's simple: X" / "The answer? X"
- Headline colon-pattern applied to everything: "Design Systems: A Love Story"
- Thai: "คำตอบคือ...", "ผลลัพธ์? ...", "ง่ายๆ เลย ...", "บอกเลยว่า..." as openers

Fix: say the thing. "The result? Faster shipping." becomes "It ships faster."

## 14. What NOT to flag

Do not "fix" these; removing them makes text sound MORE artificial:

- The user's own quirks, dialect, or profanity when editing their text.
- Genuine lists with genuine items.
- Technical terms of art (design tokens, pull request). Jargon a practitioner uses daily is voice.
- Real contrasts that carry information (see section 2, allowed cases).
- Regional spelling and punctuation conventions.
