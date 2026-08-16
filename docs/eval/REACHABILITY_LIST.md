# REACHABILITY LIST — confirm contacts in ONE pass (owner)

Item 3. Today only immediate family is a reachable contact by default; everyone else is answered
("who is X") but never offered a message/call. Rather than enter people one by one, tick section B
below and I (or you) add `reachable: true` to each in knowledge/family_data.json via the
`add-family-member` skill, then `npm run generate:*`. Sections A and C need no action.

⚠ DATA GAPS found while building this (verify, then fix via the skill — NOT hand-edited here):
- **דורה (Dora) and יעקב (Jacobo)** are listed as Martita's mother and father with no `deceased` flag.
  She is 80+, so they are almost certainly deceased — they appear in section B only because the data
  marks them living. If deceased, set `deceased: true` (then Abu declines reaching them gently, and
  they leave the contact list). FLAGGED, not assumed.
- **מרקוס גרינברג** is a `historical` youth acquaintance — almost certainly not a current contact.
- The Vancouver branch (מריו, ססי, גבי, אריאל בן טאבלה) are distant relatives abroad — unlikely contacts.

## A · REACHABLE BY DEFAULT (immediate family — already ON, no action)
  [x] אדר            — נכד (הצעיר של מור ורפי)
  [x] עדי            — נכד (בן של לאו)
  [x] איילון         — נכד (בן של מור ורפי)
  [x] עילי           — נכד (בן של מור ורפי), נשוי לירדן
  [x] גלעד           — בן זוג של אופיר
  [x] לאו            — הבן
  [x] מור            — הבת, גרושה מרפי, בת זוג של יעל
  [x] נועם           — נכד (בן של לאו)
  [x] אופיר          — נכדה (בת של מור ורפי)
  [x] רפי            — הגרוש של מור, אבא של הנכדים
  [x] יעל            — בת זוג של מור
  [x] ירדן           — כלה (אשת עילי)

## B · PLAUSIBLE CONTACTS — tick the ones who have a phone she would call/message
     (living close_friends + extended family; add reachable:true in family_data.json for each ✓)
  [ ] אאצ'י            — אשת חורחה  (extended_family)
  [ ] אריאל (בן טאבלה) — בן של טאבלה (וונקובר)  (extended_family)
  [ ] בובי             — אח של מרטיטה  (extended_family)
  [ ] כאצ'ו            — בעלה של שושנה  (close_friends)
  [ ] ססי              — אשתו של מריו (וונקובר)  (extended_family)
  [ ] דני              — בעלה של טוצ'י  (close_friends)
  [ ] דורה             — אמא של מרטיטה  (extended_family)
  [ ] דביקו            — בעלה של פלורי  (close_friends)
  [ ] אלסי             — חברה  (close_friends)
  [ ] פאבי             — בן של חורחה ואאצ'י  (extended_family)
  [ ] פלורי            — חברה מהעולם הישן של מנדוסה  (close_friends)
  [ ] גבי              — אשתו של אריאל (וונקובר)  (extended_family)
  [ ] איסידורו קאני    — בעלה של אולגה  (close_friends)
  [ ] יעקב             — אבא של מרטיטה  (extended_family)
  [ ] חורחה            — אחיין של מרטיטה (בן של לואיס)  (extended_family)
  [ ] ליאור            — בן של רוסיטה  (extended_family)
  [ ] לידיה אומנסקי    — חברה קרובה מאוד  (close_friends)
  [ ] מרקוס גרינברג    — חבר מהנעורים של מרטיטה (היסטורי)  (extended_family)
  [ ] מריו             — בן של טאבלה (וונקובר)  (extended_family)
  [ ] מריסה מינושין    — בת של מירטה מינושין  (close_friends)
  [ ] מרטין            — בן של חורחה ואאצ'י  (extended_family)
  [ ] מירטה            — חברה קרובה  (close_friends)
  [ ] מוריאן מינושין   — חבר של לאו, בן של מירטה  (close_friends)
  [ ] נילי             — בת הזוג של רפי  (extended_family)
  [ ] נוח אומנסקי      — חבר קרוב מאוד  (close_friends)
  [ ] אולגה קאני       — חברה טובה ממנדוסה  (close_friends)
  [ ] אוסקר            — בעלה של רוסיטה  (extended_family)
  [ ] אחיו הגדול       — אחיו הגדול של פפי  (extended_family)
  [ ] פופה יווניר      — חברה מהמנדוסה  (close_friends)
  [ ] רון              — בן של רוסיטה  (extended_family)
  [ ] רוסיטה           — אחייניתו של פפי  (extended_family)
  [ ] רותי             — גרושתו של לאו, אמם של עדי ונועם  (extended_family)
  [ ] שאול             — בעלה של אלסי  (close_friends)
  [ ] שרון             — חברה קרובה של המשפחה  (close_friends)
  [ ] שושנה            — חברה קרובה  (close_friends)
  [ ] סוזנה            — גרושתו של בובי  (extended_family)
  [ ] סוזי רז          — חברה טובה  (close_friends)
  [ ] טאבלה            — אחותו הגדולה של פפי  (extended_family)
  [ ] טוצ'י            — חברה טובה  (close_friends)
  [ ] יארון מינושין    — בן של מירטה מינושין  (close_friends)
  [ ] יואב             — בן של רוסיטה  (extended_family)

## C · NOT CONTACTS (deceased / infants / by-design) — leave OFF
  [-] אנאבל            — נינה (בת של אופיר וגלעד)  (great_grandchildren)
  [-] ארי              — נינה (בת של אופיר וגלעד)  (great_grandchildren)
  [-] אריאל (בן בובי)  — בן של בובי וסוזנה ז"ל  (deceased)
  [-] דניאל יווניר     — בעלה של פופה ז"ל  (deceased)
  [-] הקטור רז         — בעלה של סוזי רז ז"ל  (deceased)
  [-] חוסה מילשטיין    — אביו של פפי ז"ל  (deceased)
  [-] לואיס            — אח של מרטיטה ז"ל  (deceased)
  [-] אוסקר מינושין    — בעלה של מירטה מינושין ז"ל  (deceased)
  [-] פפי              — הבעל ז"ל  (deceased)
  [-] אחיו שנפטר בילדות — אחיו של פפי שנפטר בילדות  (deceased)
  [-] סופיה            — אשת לואיס ז"ל  (deceased)