ALTER TABLE "homes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_homes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ALTER COLUMN "transaction_type" SET DATA TYPE "public"."inventory_transaction_type";--> statement-breakpoint
CREATE POLICY "homes_select_member" ON "homes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        EXISTS(
          SELECT 1 FROM user_homes uh
           WHERE uh.home_id = "homes"."id" AND uh.user_id = auth.uid()
        )
      );--> statement-breakpoint
CREATE POLICY "items_select_member" ON "items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        EXISTS(
          SELECT 1 FROM user_homes uh
           WHERE uh.home_id = "items"."home_id" AND uh.user_id = auth.uid()
        )
      );--> statement-breakpoint
CREATE POLICY "user_homes_select_self" ON "user_homes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_homes"."user_id" = auth.uid());