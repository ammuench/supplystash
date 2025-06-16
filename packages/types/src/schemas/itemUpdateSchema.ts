import { z } from "zod";

export const SUPPLY_ITEM_UPDATE_ACTION = [
  "decrease_amt",
  "increase_amt",
  "set_amt",
  "create_item",
  "change_item_information", // TODO: See if we want to keep this--we're not going to use it for now
] as const;
export type SupplyItemUpdateAction = (typeof SUPPLY_ITEM_UPDATE_ACTION)[number];

export const supplyItemUpdateSchema = z.object({
  action: z.enum(SUPPLY_ITEM_UPDATE_ACTION),
  amount: z.number().nonnegative(),
});

export type SupplyItemUpdatePayload = z.infer<typeof supplyItemUpdateSchema>;
