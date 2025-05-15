import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { type SupplyItem, supplyItemSchema } from "@supplystash/types";

export const generateMockItems = (itemAmt: number = 1) => {
  return new Array(itemAmt).fill(null).map(() => {
    const fakeItem = generateMock(supplyItemSchema, {
      stringMap: {
        name: () => faker.commerce.productName(),
        description: () => faker.commerce.productDescription(),
        imageUrl: () =>
          `https://picsum.photos/id/${faker.number.int({ min: 0, max: 1000 })}/200/200`,
      },
    });
    return fakeItem;
  }) as SupplyItem[];
};
