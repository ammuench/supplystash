import { faker } from "@faker-js/faker";
import { randomUUID as uuidv4 } from "node:crypto";

import { db } from ".";
import { homes, items, userHomes, users } from "./schema";

const seed = async () => {
  console.log("Starting database seeding...");

  try {
    // --- 1. Create a Mock User ---
    const mockUser = {
      id: uuidv4(),
      email: faker.internet.email(),
      username: faker.internet.userName(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      profileImageUrl: faker.image.avatar(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(`Creating user: ${mockUser.email}`);
    await db.insert(users).values(mockUser);

    // --- 2. Create a Mock Home for the User ---
    const mockHome = {
      id: uuidv4(), // Generate a UUID for the home
      name: faker.company.buzzPhrase(), // A catchy name for the home
      description: faker.lorem.sentence(),
      createdById: mockUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(`Creating home: ${mockHome.name}`);
    await db.insert(homes).values(mockHome);

    // --- 3. Link the User to the Home with 'owner' role ---
    const mockUserHome = {
      userId: mockUser.id,
      homeId: mockHome.id,
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(
      `Linking user ${mockUser.username} to home ${mockHome.name} as owner`
    );
    await db.insert(userHomes).values(mockUserHome);

    // --- 4. Create Ten Mock Supply Items for the Home ---
    const mockItems = [];
    for (let i = 0; i < 10; i++) {
      const itemName = faker.commerce.productName();
      mockItems.push({
        id: uuidv4(),
        homeId: mockHome.id,
        title: itemName,
        description: faker.commerce.productDescription(),
        photoUrl: faker.image.urlLoremFlickr({
          category: "food",
          width: 640,
          height: 480,
        }),
        purchaseLink: faker.internet.url(),
        currentInventory: faker.number.int({ min: 1, max: 20 }),
        warningAmount: faker.number.int({ min: 0, max: 5 }),
        isArchived: false,
        createdById: mockUser.id,
        lastUpdatedById: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(
      `Creating ${mockItems.length} mock items for home ${mockHome.name}`
    );
    await db.insert(items).values(mockItems);

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Database seeding failed:", error);
    process.exit(1); // Exit with error code
  } finally {
  }
};

seed();
