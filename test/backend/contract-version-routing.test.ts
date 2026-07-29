// V1/V2 routing helpers — pure, no chain calls. Uses jest.isolateModules so
// the env vars are read fresh each time `lib/contracts` is required.

describe("contract version routing", () => {
  const V1_ADDR = "0x1111111111111111111111111111111111111111";
  const V2_ADDR = "0x2222222222222222222222222222222222222222";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_QUESTLOCK_CORE_ADDRESS = V1_ADDR;
    process.env.NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS = V2_ADDR;
    jest.resetModules();
  });

  test("legacy (v1 / version 1 / null / undefined) routes to V1 address", () => {
    jest.isolateModules(() => {
      const { coreAddressFor } = require("../../lib/contracts");
      expect(coreAddressFor(1).toLowerCase()).toBe(V1_ADDR.toLowerCase());
      expect(coreAddressFor(null).toLowerCase()).toBe(V1_ADDR.toLowerCase());
      expect(coreAddressFor(undefined).toLowerCase()).toBe(V1_ADDR.toLowerCase());
    });
  });

  test("v2 routes to V2 address", () => {
    jest.isolateModules(() => {
      const { coreAddressFor } = require("../../lib/contracts");
      expect(coreAddressFor(2).toLowerCase()).toBe(V2_ADDR.toLowerCase());
    });
  });

  test("v2 throws if V2 address is missing", () => {
    delete process.env.NEXT_PUBLIC_QUESTLOCK_CORE_V2_ADDRESS;
    jest.isolateModules(() => {
      const { coreAddressFor } = require("../../lib/contracts");
      expect(() => coreAddressFor(2)).toThrow(/V2/);
    });
  });
});
