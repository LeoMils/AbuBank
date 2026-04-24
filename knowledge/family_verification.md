# Family Data Hebrew Verification

This file verifies that Hebrew strings in the AbuBank family/knowledge data
are stored in correct Unicode codepoint order (logical order, left-to-right
in memory, displayed right-to-left by BiDi rendering).

**Important:** Terminal and editor displays may visually render Hebrew
"backwards" due to RTL/BiDi behavior. The codepoint sequences below are
the source of truth. Do NOT reverse any Hebrew string unless the codepoint
order is actually wrong.

## Verification Table

| Field | Hebrew Value | Unicode Codepoints | English Meaning |
|---|---|---|---|
| abu.hebrew_name | אבו | U+05D0 U+05D1 U+05D5 | "Abu" — app brand name |
| abu.location | כפר סבא | U+05DB U+05E4 U+05E8 U+0020 U+05E1 U+05D1 U+05D0 | "Kfar Saba" — Martita's city |
| mor.location | הוד השרון | U+05D4 U+05D5 U+05D3 U+0020 U+05D4 U+05E9 U+05E8 U+05D5 U+05DF | "Hod HaSharon" — Mor's city |
| rafi.location | ראש העין | U+05E8 U+05D0 U+05E9 U+0020 U+05D4 U+05E2 U+05D9 U+05DF | "Rosh HaAyin" — Rafi's city |
| adi.location | תל אביב | U+05EA U+05DC U+0020 U+05D0 U+05D1 U+05D9 U+05D1 | "Tel Aviv" — Adi's city |
| noam.location | הרצליה | U+05D4 U+05E8 U+05E6 U+05DC U+05D9 U+05D4 | "Herzliya" — Noam's city |
| yarden.hebrew_name | ירדן | U+05D9 U+05E8 U+05D3 U+05DF | "Yarden" — Ofir's wife |
| eili.hebrew_name | עילי | U+05E2 U+05D9 U+05DC U+05D9 | "Eili" (Ilai) — grandson of Mor & Rafi |
| ayalon.hebrew_name | איילון | U+05D0 U+05D9 U+05D9 U+05DC U+05D5 U+05DF | "Ayalon" (Eylon) — grandson of Mor & Rafi |

## Unicode Hebrew Block Reference

| Codepoint | Letter | Name |
|---|---|---|
| U+05D0 | א | Alef |
| U+05D1 | ב | Bet |
| U+05D2 | ג | Gimel |
| U+05D3 | ד | Dalet |
| U+05D4 | ה | He |
| U+05D5 | ו | Vav |
| U+05D6 | ז | Zayin |
| U+05D7 | ח | Het |
| U+05D8 | ט | Tet |
| U+05D9 | י | Yod |
| U+05DA | ך | Final Kaf |
| U+05DB | כ | Kaf |
| U+05DC | ל | Lamed |
| U+05DD | ם | Final Mem |
| U+05DE | מ | Mem |
| U+05DF | ן | Final Nun |
| U+05E0 | נ | Nun |
| U+05E1 | ס | Samekh |
| U+05E2 | ע | Ayin |
| U+05E3 | ף | Final Pe |
| U+05E4 | פ | Pe |
| U+05E5 | ץ | Final Tsadi |
| U+05E6 | צ | Tsadi |
| U+05E7 | ק | Qof |
| U+05E8 | ר | Resh |
| U+05E9 | ש | Shin |
| U+05EA | ת | Tav |

## Verification Method

Each Hebrew value was extracted using `String.prototype.codePointAt()` in
Node.js to produce the Unicode codepoint sequence. The codepoints are in
logical (memory) order — first codepoint is the first letter of the Hebrew
word when read right-to-left.

For example, אבו (Abu):
- U+05D0 = א (Alef) — first letter
- U+05D1 = ב (Bet) — second letter
- U+05D5 = ו (Vav) — third letter

This confirms the string is stored in correct logical order.
