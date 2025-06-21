import { faker } from "@faker-js/faker";
import * as dotenv from "dotenv";
import { randomUUID as uuidv4 } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { db } from ".";
import { homes, items, user_homes, users } from "./schema";

const seed = async () => {
  console.log("Starting database seeding...");

  const dirname = path.dirname(fileURLToPath(import.meta.url));

  dotenv.config({ path: path.resolve(dirname, "../../../../.env.local") });

  if (!process.env.SEED_ACCOUNT_ID) {
    console.warn(
      "ERR: Need seed account ID to properly map data to existing account"
    );
    return;
  }

  try {
    // --- 1. Create a Mock User ---
    const mock_user = {
      id: process.env.SEED_ACCOUNT_ID,
      email: faker.internet.email(),
      username: faker.internet.userName(),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      profile_image_url: faker.image.avatar(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    console.log(`Creating user: ${mock_user.email}`);
    await db.insert(users).values(mock_user);

    // --- 2. Create a Mock Home for the User ---
    const mock_home = {
      id: uuidv4(), // Generate a UUID for the home
      name: faker.company.buzzPhrase(), // A catchy name for the home
      description: faker.lorem.sentence(),
      created_by_id: mock_user.id,
      created_at: new Date(),
      updated_at: new Date(),
    };

    console.log(`Creating home: ${mock_home.name}`);
    await db.insert(homes).values(mock_home);

    // --- 3. Link the User to the Home with 'owner' role ---
    const mock_user_home = {
      user_id: mock_user.id,
      home_id: mock_home.id,
      role: "owner",
      created_at: new Date(),
      updated_at: new Date(),
    };

    console.log(
      `Linking user ${mock_user.username} to home ${mock_home.name} as owner`
    );
    await db.insert(user_homes).values(mock_user_home);

    // --- 4. Create Ten Mock Supply Items for the Home ---
    const mock_items = [];
    for (let i = 0; i < 10; i++) {
      const item_name = faker.commerce.productName();
      mock_items.push({
        id: uuidv4(),
        home_id: mock_home.id,
        title: item_name,
        description: faker.commerce.productDescription(),
        photo_url: faker.image.urlLoremFlickr({
          category: "food",
          width: 640,
          height: 480,
        }),
        purchase_link: faker.internet.url(),
        current_inventory: faker.number.int({ min: 1, max: 20 }),
        warning_amount: faker.number.int({ min: 0, max: 5 }),
        is_archived: false,
        created_by_id: mock_user.id,
        last_updated_by_id: mock_user.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    console.log(
      `Creating ${mock_items.length} mock items for home ${mock_home.name}`
    );
    await db.insert(items).values(mock_items);

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Database seeding failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

seed();
