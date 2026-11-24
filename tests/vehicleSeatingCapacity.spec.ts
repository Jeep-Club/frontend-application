import { vehicleSeatingCapacitySchema } from "@/schemas/vehicles/seating-capacity";

describe("vehicle seating capacity", () => {
    it.each([1, 40])("accepts %i seats", seats => {
        expect(vehicleSeatingCapacitySchema.parse(String(seats))).toBe(seats);
    });

    it.each(["", "0", "-1", "41", "1.5", "4e1"])("rejects %s", value => {
        expect(vehicleSeatingCapacitySchema.safeParse(value).success).toBe(false);
    });
});
