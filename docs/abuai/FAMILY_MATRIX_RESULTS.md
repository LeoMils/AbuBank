# Family-Relation Matrix — Deterministic Results

_Identity, aliases, pronouns, location, inferred relations, Spanish, and unknown-relation safety. Perspective "שלך" enforced; unknowns never invented._

| ID | Query | Answer | Result | Note |
|----|-------|--------|--------|------|
| M-MOR | מי זאת מור? | מור, הבת שלך. בהוד השרון עם יעל. | ✅ | Mor = daughter, POV |
| M-YAEL | מי זאת יעל? | יעל, בת הזוג של מור. בהוד השרון. | ✅ | Yael = Mor partner |
| M-OFIR | מי זה אופיר? | אופיר, הנכד שלך. עם גלעד. | ✅ | Ofir grandchild |
| M-AYALON | מי זה איילון? | איילון, הנכד שלך. | ✅ | Ayalon grandchild |
| M-EILI | מי זה עילי? | עילי, הנכד שלך. | ✅ | Eili grandchild |
| M-ADAR | מי זה אדר? | אדר, הנכד שלך. | ✅ | Adar grandchild |
| M-ARI | מי זה ארי? | ארי, הנינה שלך. | ✅ | Ari great-grandchild |
| M-ANABEL | מי זאת אנאבל? | אנאבל, הנינה שלך. | ✅ | Anabel great-grandchild |
| M-GILAD | מי זה גלעד? | גלעד — בן זוג של אופיר. | ✅ | Gilad spouse of Ofir |
| M-PEPE | מי זה פפי? | פפי, בעלך ז"ל. | ✅ | Pepe = late husband |
| A-MORI | מי זאת מורי? | מור, הבת שלך. בהוד השרון עם יעל. | ✅ | alias מורי → Mor |
| A-PEPE2 | מי זה פאפי? | פפי, בעלך ז"ל. | ✅ | alias פאפי → Pepe |
| R-OFIR-MOM | מי אמא של אופיר? | מור. | ✅ | Ofir mother = Mor |
| R-ARI-GGM | מי סבתא רבתא של ארי? | מרטיטה. | ✅ | Ari great-grandmother = Martita |
| R-ANABEL-GGM | מי סבתא רבתא של אנאבל? | מרטיטה. | ✅ | Anabel great-grandmother = Martita |
| R-OFIR-UNCLE | מי דוד של אופיר? | לאו. | ✅ | Ofir uncle = Leo |
| R-NOAM-GM | מי סבתא של נועם? | מרטיטה. | ✅ | Noam grandmother = Martita |
| R-ARI-PARENTS | מי ההורים של ארי? | אופיר וגלעד. | ✅ | Ari parents = Ofir+Gilad |
| L-MOR | איפה גרה מור? | מור גרה בהוד השרון, וילה עם יעל. | ✅ | Mor location |
| L-OFIR-EILI | איפה גר עילי? | אין לי מידע איפה עילי גר. | ✅ | Eili location |
| ES-OFIR-MOM | ¿quién es la mamá de Ofir? | La mamá de Ofir es Mor. | ✅ | ES Ofir mom, no leak |
| ES-ANABEL-GGM | ¿quién es la bisabuela de Anabel? | La bisabuela de Annabel es Abu. | ✅ | ES Anabel great-grandma |
| ES-MOR-HIJA | ¿quién es la hija de Mor? | Mor no tiene hija. | ✅ | ES honest: Mor has no daughter (all sons) |
| RL-SIB | מי האח של אופיר? | איילון ועילי ואדר. | ✅ | Ofir brothers |
| RL-SIBS | מי האחים של אופיר? | איילון ועילי ואדר. | ✅ | all siblings |
| RL-COUSIN | מי בן הדוד של עדי? | אופיר ואיילון ועילי ואדר. | ✅ | Adi cousins |
| RL-UNCLE | מי הדוד של אופיר? | לאו. | ✅ | Ofir uncle = Leo |
| RL-WIFE | מי האישה של עילי? | ירדן. | ✅ | Eili wife = Yarden |
| RL-NOAUNT | מי הדודה של אופיר? | לא יודעת מי דודה של אופיר. | ✅ | no aunt → honest decline |
| RL-NOSIS | מי האחות של אופיר? | לא יודעת מי אחות של אופיר. | ✅ | no sister → no invention |
| A-LEON | מי זה לאון? | לאו, הבן שלך. | ✅ | alias לאון → Leo |
| A-LIO | מי זה ליאו? | לאו, הבן שלך. | ✅ | alias ליאו → Leo |
| G-GRANDKIDS | מי הנכדים שלי? | יש לך 6 נכדים — אופיר, איילון, עילי, אדר, עדי, נועם. | ✅ | all grandchildren |
| G-LEO-KIDS | מי הילדים של לאו? | ללאו יש 2 ילדים — עדי, נועם. | ✅ | Leo's children |
| U-1 | מי זה זבולון הקוסם? | לא יודעת. | ✅ | unknown → no invented relation |
| U-2 | מי סבתא רבתא של דניאל הלא-קיים? | ∅ | ✅ | unknown great-grandchild → no invention |
| D-UNK | describeRelation(unknown) | null | ✅ | returns null, no invention |
| D-ES-UNK | resolveRelationalQuery(unknown,es) | null | ✅ | declines |

**Total 38 · pass 38 · fail 0**