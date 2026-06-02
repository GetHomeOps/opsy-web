import { describe, expect, it } from "vitest";
import {
  getPropertyStreetLine,
  mapPropertyFromBackend,
} from "./preparePropertyValues";

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

describe("getPropertyStreetLine", () => {
  it("prefers address_line_1 over a combined address field", () => {
    expect(
      getPropertyStreetLine({
        address: "205 E 95th St, New York, NY 10128",
        address_line_1: "205 E 95th St",
        city: "New York",
        state: "NY",
      }),
    ).toBe("205 E 95th St");
  });

  it("strips city, state, and zip from a comma-separated address", () => {
    expect(
      getPropertyStreetLine({
        address: "205 E 95th St, New York, NY 10128",
        city: "New York",
        state: "NY",
        zip: "10128",
      }),
    ).toBe("205 E 95th St");
  });
});
