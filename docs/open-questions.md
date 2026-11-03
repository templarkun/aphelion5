# Open questions for the designer

Rules gaps found while coding. Until a question is answered, the program does
not guess: the case is refused with an error naming the question.

| # | Found | Question | Where it matters | Status |
| --- | --- | --- | --- | --- |
| Q1 | 2026-11-03, stage 2 | Is "deal 0 damage" a hit? If yes, it uses up a Barrier (6.4) and does nothing else. If no, nothing happens at all. | Accumulator Beam (Module 6) run with no Yellow on it gives X = 0: "Deal X damage to one unit". | Open |
