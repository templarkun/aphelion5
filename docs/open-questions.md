# Open questions for the designer

Rules gaps found while coding. Until a question is answered, the program does
not guess: the case is refused with an error naming the question.

| # | Found | Question | Where it matters | Status |
| --- | --- | --- | --- | --- |
| Q1 | 2026-11-03, stage 2 | Is "deal 0 damage" a hit? If yes, it uses up a Barrier (6.4) and does nothing else. If no, nothing happens at all. | Accumulator Beam (Module 6) run with no Yellow on it gives X = 0: "Deal X damage to one unit". | Answered 2026-11-03: not a hit. A hit is at least 1 damage; 0 damage does nothing at all. |
| Q2 | 2026-11-03, stage 3 | A Dark sector can hold face-up tiles lower down (after Bury, or Overhaul step 5). If V1 Bay 3 ("put them back in any order") or V2_P3 / V2_P3A ("move the fourth/fifth tile to the top") puts a face-up tile on top, is that allowed? The program reads it literally: allowed; the tile is uncovered, not revealed (3.4); V1 Bay 3's "Then Reveal" is skipped because the sector is no longer Dark (11.1 rule 5). | V1 Bay 3, V2_P3, V2_P3A | Open (built as described; please confirm) |
