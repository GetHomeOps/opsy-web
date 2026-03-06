import { describe, it, expect } from "vitest";
import { parseAddressFromPlace } from "./useGooglePlacesAutocomplete";

describe("parseAddressFromPlace", () => {
  it("parses address components into the expected form shape", () => {
    const place = {
      formattedAddress: "123 Main St, Seattle, WA 98101, USA",
      addressComponents: [
        { types: ["street_number"], longText: "123", shortText: "123" },
        { types: ["route"], longText: "Main St", shortText: "Main St" },
        { types: ["locality"], longText: "Seattle", shortText: "Seattle" },
        {
          types: ["administrative_area_level_1"],
          longText: "Washington",
          shortText: "WA",
        },
        { types: ["postal_code"], longText: "98101", shortText: "98101" },
        {
          types: ["administrative_area_level_2"],
          longText: "King County",
          shortText: "King County",
        },
        { types: ["country"], longText: "United States", shortText: "US" },
      ],
    };

    const result = parseAddressFromPlace(place);

    expect(result).toEqual({
      addressLine1: "123 Main St",
      addressLine2: "",
      city: "Seattle",
      state: "WA",
      zip: "98101",
      county: "King",
      formattedAddress: "123 Main St, Seattle, WA 98101, USA",
    });
  });

  it("handles subpremise (address line 2)", () => {
    const place = {
      formattedAddress: "123 Main St Apt 4, Seattle, WA 98101",
      addressComponents: [
        { types: ["street_number"], longText: "123", shortText: "123" },
        { types: ["route"], longText: "Main St", shortText: "Main St" },
        { types: ["subpremise"], longText: "Apt 4", shortText: "Apt 4" },
        { types: ["locality"], longText: "Seattle", shortText: "Seattle" },
        {
          types: ["administrative_area_level_1"],
          longText: "Washington",
          shortText: "WA",
        },
        { types: ["postal_code"], longText: "98101", shortText: "98101" },
      ],
    };

    const result = parseAddressFromPlace(place);

    expect(result.addressLine1).toBe("123 Main St");
    expect(result.addressLine2).toBe("Apt 4");
  });

  it("handles missing address components gracefully", () => {
    const place = {
      formattedAddress: "Some Place, USA",
      addressComponents: [],
    };

    const result = parseAddressFromPlace(place);

    expect(result).toEqual({
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
      county: "",
      formattedAddress: "Some Place, USA",
    });
  });

  it("parsed output matches the shape expected by onPlaceSelected callback", () => {
    const place = {
      formattedAddress: "456 Oak Ave, Portland, OR 97201, USA",
      addressComponents: [
        { types: ["street_number"], longText: "456", shortText: "456" },
        { types: ["route"], longText: "Oak Ave", shortText: "Oak Ave" },
        { types: ["locality"], longText: "Portland", shortText: "Portland" },
        {
          types: ["administrative_area_level_1"],
          longText: "Oregon",
          shortText: "OR",
        },
        { types: ["postal_code"], longText: "97201", shortText: "97201" },
      ],
    };

    const result = parseAddressFromPlace(place);
    const onPlaceSelected = (parsed) => {
      expect(parsed).toHaveProperty("addressLine1");
      expect(parsed).toHaveProperty("addressLine2");
      expect(parsed).toHaveProperty("city");
      expect(parsed).toHaveProperty("state");
      expect(parsed).toHaveProperty("zip");
      expect(parsed).toHaveProperty("county");
      expect(parsed).toHaveProperty("formattedAddress");
    };
    onPlaceSelected(result);
    expect(result.formattedAddress).toBe(
      "456 Oak Ave, Portland, OR 97201, USA"
    );
  });
});
