import { describe, expect, it } from "vitest";
import { mapPropertyFromBackend } from "./preparePropertyValues";

describe("mapPropertyFromBackend", () => {
  it("fills addressLine1 from address for imported properties", () => {
    const result = mapPropertyFromBackend({
      address: "18411 22nd Dr. SE",
      city: "Kent",
      state: "WA",
      zip: "98042",
    });

    expect(result.address).toBe("18411 22nd Dr. SE");
    expect(result.addressLine1).toBe("18411 22nd Dr. SE");
  });

  it("keeps explicit addressLine1 when the backend already provides it", () => {
    const result = mapPropertyFromBackend({
      address: "18411 22nd Dr. SE",
      address_line_1: "18411 22nd Dr. SE Unit B",
      city: "Kent",
      state: "WA",
      zip: "98042",
    });

    expect(result.addressLine1).toBe("18411 22nd Dr. SE Unit B");
  });
});
