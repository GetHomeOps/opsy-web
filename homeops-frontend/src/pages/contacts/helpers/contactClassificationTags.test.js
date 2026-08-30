import {describe, expect, it} from "vitest";
import {
  classificationFilterOptions,
  classificationTagsFromContact,
  isClassificationTag,
} from "./contactClassificationTags";

describe("isClassificationTag", () => {
  it("accepts Homeowner and Professional", () => {
    expect(isClassificationTag({name: "Homeowner"})).toBe(true);
    expect(isClassificationTag({name: "professional"})).toBe(true);
  });

  it("rejects Installer and custom tags", () => {
    expect(isClassificationTag({name: "Installer"})).toBe(false);
    expect(isClassificationTag({name: "VIP"})).toBe(false);
  });
});

describe("classificationTagsFromContact", () => {
  it("keeps only Homeowner and Professional", () => {
    const tags = classificationTagsFromContact({
      tags: [
        {id: 1, name: "Installer"},
        {id: 2, name: "Professional"},
        {id: 3, name: "Homeowner"},
      ],
    });
    expect(tags.map((t) => t.name)).toEqual(["Professional", "Homeowner"]);
  });
});

describe("classificationFilterOptions", () => {
  it("returns Homeowner and Professional from the catalog, in that order", () => {
    const options = classificationFilterOptions(
      [
        {id: 10, name: "VIP"},
        {id: 8, name: "Professional"},
        {id: 7, name: "Homeowner"},
        {id: 9, name: "Installer"},
      ],
      [],
    );
    expect(options).toEqual([
      {value: "7", label: "Homeowner"},
      {value: "8", label: "Professional"},
    ]);
  });
});
