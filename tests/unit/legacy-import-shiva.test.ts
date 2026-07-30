import { describe, it, expect } from "vitest";
import { extractNiftarName } from "../../scripts/legacy-import/parse";
import { htmlToLine } from "../../scripts/legacy-import/lib";

/**
 * Every input below is a verbatim legacy title from FrumShared BlogEntries
 * category 85 (after entity decoding), collected by tallying all 3,553 rows.
 */
describe("extractNiftarName", () => {
  const cases: [string, string][] = [
    // The four most common prefix families.
    ['Funeral and Shiva Notification - Maxwell Latner, z"l', "Maxwell Latner"],
    ['Funeral and Shiva Notice for Mrs. Helen Philips, A"H', "Mrs. Helen Philips"],
    ["Bereavement Notice for Carrie Grossman z”l", "Carrie Grossman"],
    ['Shiva Notification - Jean Diamond A"H', "Jean Diamond"],
    ['Passing of Patty Stark z"l', "Patty Stark"],

    // Prefixes only discovered by reviewing flagged output.
    ['Funeral Notice - Mr. Norman Nahum Bobrowsky', "Mr. Norman Nahum Bobrowsky"],
    ['Funeral Notice -Mr. Michael Faith', "Mr. Michael Faith"],
    ['Shiva - Aida Perez', "Aida Perez"],
    ['Our Condolences on the Passing of Mr. Moshe Katz', "Mr. Moshe Katz"],
    ['Petira of Rav Elya Boruch Finkel ZATZAL', "Rav Elya Boruch Finkel"],

    // Honorific mid-string with a relationship clause and no comma.
    [
      "Mr. Shlomo Yitzchok Galet O”H Brother of Mr. Emil Galet",
      "Mr. Shlomo Yitzchok Galet",
    ],

    // Relationship clause introduced by a comma.
    [
      'Bereavement- Esther Cojocaru z"l, beloved mother of Sarah Cojocaru',
      "Esther Cojocaru",
    ],
    [
      'Bereavement Information for Dr. Harvey Taub, z"l, brother of HaRav Baruch Taub',
      "Dr. Harvey Taub",
    ],

    // Honorific with no punctuation at all.
    ["Mrs. Shaindy Maierovits AH", "Mrs. Shaindy Maierovits"],

    // Trailing period after the honorific.
    ['Nancy Posluns A"H.', "Nancy Posluns"],

    // Longer stacked prefix.
    [
      "Bereavement & Shiva Information for Esther Schwartz z”l",
      "Esther Schwartz",
    ],
    ["Baruch Dayan Haemes- Yaakov Boim z”l", "Yaakov Boim"],
    ["Updated: Shiva Notification - Reuben Klein", "Reuben Klein"],
  ];

  for (const [input, expected] of cases) {
    it(`extracts ${JSON.stringify(expected)} from ${JSON.stringify(input)}`, () => {
      expect(extractNiftarName(input)).toBe(expected);
    });
  }

  it("does not strip an honorific that is part of a name-like word", () => {
    // The negative lookahead for a following letter prevents "Ahuva" or "Zlata"
    // from being read as the honorifics "ah" / "zl".
    expect(extractNiftarName("Ahuva Zlata Klein")).toBe("Ahuva Zlata Klein");
  });

  it("keeps a bare name untouched", () => {
    expect(extractNiftarName("Zev Shmuel Prisman")).toBe("Zev Shmuel Prisman");
  });

  it("returns empty string when the title is only a prefix", () => {
    expect(extractNiftarName("Bereavement Notice for")).toBe("");
    expect(extractNiftarName("Baruch Dayan Haemes")).toBe("");
  });

  it("handles the HTML-entity form the legacy titles are stored in", () => {
    // Raw DB value for legacy row 36189.
    const raw = "Bereavement Notice for Carrie Grossman z&quot;l";
    expect(extractNiftarName(htmlToLine(raw))).toBe("Carrie Grossman");
  });

  it("handles the cp1252 apostrophe form of a&#146;h", () => {
    const raw = "Funeral and Shiva Notice for Irvin Pitch a&#146;h";
    expect(extractNiftarName(htmlToLine(raw))).toBe("Irvin Pitch");
  });

  it("is idempotent", () => {
    const once = extractNiftarName('Passing of Ruth Shapiro z"l');
    expect(extractNiftarName(once)).toBe(once);
  });
});
