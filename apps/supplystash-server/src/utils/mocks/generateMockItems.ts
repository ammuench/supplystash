import { generateMock } from "@anatine/zod-mock";
import { type SupplyItem, supplyItemSchema } from "@supplystash/types";

export const generateMockItems = (itemAmt: number = 1) => {
  return new Array(itemAmt).fill(null).map(() => {
    const fakeItem = generateMock(supplyItemSchema);
    return fakeItem;
  }) as SupplyItem[];
};
