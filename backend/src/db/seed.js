require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

async function resetAndSeed() {
  const client = await pool.connect();

  try {
    console.log("\n🗑️  Clearing all existing data...\n");

    // Clear in dependency order (children first)
    await client.query("DELETE FROM dispatch_rejections");
    await client.query("DELETE FROM ride_dispatch_queue");
    await client.query("DELETE FROM ride_dispatches");
    await client.query("DELETE FROM operator_assignments");
    await client.query("DELETE FROM incident_tracking");
    await client.query("DELETE FROM sms_queue");
    await client.query("DELETE FROM email_queue");
    await client.query("DELETE FROM notifications");
    await client.query("DELETE FROM ticket_purchases");
    await client.query("DELETE FROM maintenance_requests");
    await client.query("DELETE FROM park_closures");
    await client.query("DELETE FROM ride_interlocks");
    await client.query("DELETE FROM merch");
    await client.query("DELETE FROM game");
    await client.query("DELETE FROM gift_shop");
    await client.query("DELETE FROM restaurant");
    await client.query("DELETE FROM customers");
    await client.query("DELETE FROM employees");
    await client.query("DELETE FROM refresh_tokens");
    await client.query("DELETE FROM users");

    // Reset sequences
    await client.query("ALTER SEQUENCE users_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE customers_customer_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE employees_employee_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE maintenance_requests_request_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE ticket_purchases_purchase_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE notifications_notification_id_seq RESTART WITH 1");

    // Reset rides to clean state (re-insert if they got deleted)
    const { rows: existingRides } = await client.query("SELECT COUNT(*) AS cnt FROM rides");
    if (parseInt(existingRides[0].cnt) === 0) {
      console.log("  ⚠️  Rides table is empty — re-inserting rides...\n");
      await client.query(`
        INSERT INTO rides (ride_name, capacity_per_cycle, min_height_in, location, status, wait_time, is_operational, description, image_url, ride_type, thrill_level)
        VALUES
          ('Cougar Express', 32, 48, 'Zone A', 'Operational', 25, true, 'Our signature steel coaster with sweeping drops, high-speed turns, and stunning mountain views. Not for the faint of heart.', '/rides/cougar-express.jpg', 'Roller Coaster', 'Extreme'),
          ('Thunder Canyon', 24, 54, 'Zone B', 'Operational', 40, true, 'A wild mine train adventure through rugged canyon terrain with sudden drops and dark tunnels.', '/rides/thunder-canyon.jpg', 'Roller Coaster', 'High'),
          ('Sky Screamer', 16, 60, 'Zone A', 'Operational', 55, true, 'Soar 200 feet above the park on this extreme swing ride with panoramic views and heart-pounding free-fall moments.', '/rides/sky-screamer.jpg', 'Thrill Ride', 'Extreme'),
          ('Wild River Rapids', 20, 42, 'Zone C', 'Operational', 30, true, 'Grab your crew and brave the rapids — you will get soaked on this whitewater rafting adventure.', '/rides/wild-river-rapids.jpg', 'Water Ride', 'Moderate'),
          ('Galactic Spinner', 28, 36, 'Zone B', 'Operational', 0, true, 'A cosmic spinning ride under neon lights. Each pod spins independently as you orbit the galaxy.', '/rides/galactic-spinner.jpg', 'Thrill Ride', 'Moderate'),
          ('Mini Coaster', 40, 0, 'Zone D', 'Operational', 15, true, 'A dragon-themed family coaster with gentle hills and playful turns. Perfect for young adventurers.', '/rides/mini-coaster.jpg', 'Family Ride', 'Family'),
          ('Ferris Wheel', 48, 0, 'Zone D', 'Operational', 10, true, 'Take in the glittering skyline from our illuminated Ferris wheel — the perfect ride for a sunset view.', '/rides/ferris-wheel.jpg', 'Family Ride', 'Family'),
          ('Haunted Mansion', 12, 48, 'Zone C', 'Operational', 35, true, 'Enter if you dare. This dark ride takes you through 13 rooms of ghostly encounters.', '/rides/haunted-mansion.jpg', 'Dark Ride', 'Moderate'),
          ('Bumper Cars', 30, 36, 'Zone D', 'Operational', 20, true, 'Classic fun for all ages. Bump, dodge, and crash your way through our neon-lit arena.', '/rides/bumper-cars.jpg', 'Family Ride', 'Family'),
          ('Drop Tower', 8, 54, 'Zone A', 'Operational', 0, true, 'Plunge from dizzying heights in a heart-stopping free-fall. Hold on tight!', '/rides/drop-tower.jpg', 'Thrill Ride', 'Extreme')
      `);
    } else {
      await client.query("UPDATE rides SET status = 'Operational', is_operational = true");
      // Update descriptions/images for existing rides that don't have them
      const descUpdates = [
        ["Cougar Express", "Our signature steel coaster with sweeping drops, high-speed turns, and stunning mountain views.", "/rides/cougar-express.jpg", "Roller Coaster", "Extreme"],
        ["Thunder Canyon", "A wild mine train adventure through rugged canyon terrain with sudden drops and dark tunnels.", "/rides/thunder-canyon.jpg", "Roller Coaster", "High"],
        ["Sky Screamer", "Soar 200 feet above the park on this extreme swing ride with panoramic views.", "/rides/sky-screamer.jpg", "Thrill Ride", "Extreme"],
        ["Wild River Rapids", "Grab your crew and brave the rapids — you will get soaked!", "/rides/wild-river-rapids.jpg", "Water Ride", "Moderate"],
        ["Galactic Spinner", "A cosmic spinning ride under neon lights. Each pod spins independently.", "/rides/galactic-spinner.jpg", "Thrill Ride", "Moderate"],
        ["Mini Coaster", "A dragon-themed family coaster with gentle hills and playful turns.", "/rides/mini-coaster.jpg", "Family Ride", "Family"],
        ["Ferris Wheel", "Take in the glittering skyline from our illuminated Ferris wheel.", "/rides/ferris-wheel.jpg", "Family Ride", "Family"],
        ["Haunted Mansion", "Enter if you dare. This dark ride takes you through 13 rooms of ghostly encounters.", "/rides/haunted-mansion.jpg", "Dark Ride", "Moderate"],
        ["Bumper Cars", "Classic fun for all ages. Bump, dodge, and crash your way through our neon-lit arena.", "/rides/bumper-cars.jpg", "Family Ride", "Family"],
        ["Drop Tower", "Plunge from dizzying heights in a heart-stopping free-fall.", "/rides/drop-tower.jpg", "Thrill Ride", "Extreme"],
      ];
      for (const [name, desc, img, rtype, thrill] of descUpdates) {
        await client.query(
          "UPDATE rides SET description = COALESCE(description, $1), image_url = COALESCE(image_url, $2), ride_type = COALESCE(ride_type, $3), thrill_level = COALESCE(thrill_level, $4) WHERE ride_name = $5",
          [desc, img, rtype, thrill, name]
        );
      }
    }

    // Get actual ride IDs from database
    const { rows: rideRows } = await client.query("SELECT ride_id, ride_name FROM rides ORDER BY ride_id");
    const rideMap = {};
    for (const r of rideRows) {
      rideMap[r.ride_name] = r.ride_id;
    }
    console.log(`  📍 Found ${rideRows.length} rides in database\n`);

    const hash = await bcrypt.hash("CougarRide2026!", 10);

    // ═══════════════════════════════════════════
    // USERS + EMPLOYEES (your team)
    // ═══════════════════════════════════════════
    console.log("👤 Creating team accounts...\n");

    // Alex Rivera — Admin
    const { rows: [alexUser] } = await client.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
      ["alex.rivera@cougarride.com", hash, "admin"]
    );
    const { rows: [alexEmp] } = await client.query(
      "INSERT INTO employees (full_name, email, role, hourly_rate, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING employee_id",
      ["Alex Rivera", "alex.rivera@cougarride.com", "admin", 35.00, alexUser.id]
    );
    console.log(`  ✅ Alex Rivera — Admin (user ${alexUser.id}, employee ${alexEmp.employee_id})`);

    // Srinath Satuluri — Manager
    const { rows: [srinathUser] } = await client.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
      ["srinath.satuluri@cougarride.com", hash, "manager"]
    );
    const { rows: [srinathEmp] } = await client.query(
      "INSERT INTO employees (full_name, email, role, hourly_rate, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING employee_id",
      ["Srinath Satuluri", "srinath.satuluri@cougarride.com", "manager", 28.00, srinathUser.id]
    );
    console.log(`  ✅ Srinath Satuluri — Manager (user ${srinathUser.id}, employee ${srinathEmp.employee_id})`);

    // Melanie Cura — Staff
    const { rows: [melanieUser] } = await client.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
      ["melanie.cura@cougarride.com", hash, "staff"]
    );
    const { rows: [melanieEmp] } = await client.query(
      "INSERT INTO employees (full_name, email, role, hourly_rate, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING employee_id",
      ["Melanie Cura", "melanie.cura@cougarride.com", "staff", 18.50, melanieUser.id]
    );
    console.log(`  ✅ Melanie Cura — Staff (user ${melanieUser.id}, employee ${melanieEmp.employee_id})`);

    // Nicholaus Mayes — Staff
    const { rows: [nichUser] } = await client.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
      ["nicholaus.mayes@cougarride.com", hash, "staff"]
    );
    const { rows: [nichEmp] } = await client.query(
      "INSERT INTO employees (full_name, email, role, hourly_rate, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING employee_id",
      ["Nicholaus Mayes", "nicholaus.mayes@cougarride.com", "staff", 18.00, nichUser.id]
    );
    console.log(`  ✅ Nicholaus Mayes — Staff (user ${nichUser.id}, employee ${nichEmp.employee_id})`);

    // ═══════════════════════════════════════════
    // CUSTOMERS (random park visitors)
    // ═══════════════════════════════════════════
    console.log("\n🎟️  Creating customer accounts...\n");

    const customers = [
      ["Maria Garcia", "maria.garcia@email.com", 8325551001, "1990-05-14"],
      ["James Wilson", "james.wilson@email.com", 7135552002, "1985-11-22"],
      ["Sarah Johnson", "sarah.johnson@email.com", 2815553003, "1998-03-08"],
      ["David Lee", "david.lee@email.com", 8325554004, "1992-07-19"],
      ["Emily Chen", "emily.chen@email.com", 7135555005, "2001-12-30"],
    ];

    const customerIds = [];
    for (const [name, email, phone, dob] of customers) {
      // Create user account for the customer
      const { rows: [custUser] } = await client.query(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
        [email, hash, "customer"]
      );
      const { rows: [cust] } = await client.query(
        "INSERT INTO customers (full_name, email, phone, date_of_birth, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING customer_id",
        [name, email, phone, dob, custUser.id]
      );
      customerIds.push(cust.customer_id);
      console.log(`  ✅ ${name} — Customer (user ${custUser.id}, customer ${cust.customer_id})`);
    }

    // ═══════════════════════════════════════════
    // TICKET PURCHASES
    // ═══════════════════════════════════════════
    console.log("\n💳 Creating ticket purchases...\n");

    const ticketData = [
      // [customer_id_index, user_id_offset, ticket_type, adults, children, adult_price, child_price, total, visit_date, card_last4, cardholder, days_ago]
      [0, 5, "General Admission", 2, 1, 49, 35, 133, "2026-04-01", "4242", "Maria Garcia", 8],
      [1, 6, "Season Pass", 1, 0, 149, 99, 149, "2026-03-20", "1234", "James Wilson", 20],
      [2, 7, "VIP Experience", 2, 2, 89, 69, 316, "2026-04-05", "5678", "Sarah Johnson", 4],
      [3, 8, "General Admission", 1, 2, 49, 35, 119, "2026-03-28", "9012", "David Lee", 12],
      [4, 9, "Season Pass", 2, 0, 149, 99, 298, "2026-03-15", "3456", "Emily Chen", 25],
      [0, 5, "General Admission", 4, 0, 49, 35, 196, "2026-04-02", "7890", "Maria Garcia", 7],
      [1, 6, "VIP Experience", 1, 1, 89, 69, 158, "2026-04-03", "2345", "James Wilson", 6],
      [2, 7, "General Admission", 2, 3, 49, 35, 203, "2026-03-30", "6789", "Sarah Johnson", 10],
      [3, 8, "Season Pass", 1, 1, 149, 99, 248, "2026-03-25", "0123", "David Lee", 15],
      [4, 9, "General Admission", 3, 0, 49, 35, 147, "2026-04-04", "4567", "Emily Chen", 5],
      [0, 5, "VIP Experience", 2, 0, 89, 69, 178, "2026-03-22", "8901", "Maria Garcia", 18],
      [1, 6, "General Admission", 1, 0, 49, 35, 49, "2026-04-08", "3456", "James Wilson", 1],
    ];

    for (const [cidx, uidOffset, type, adults, children, ap, cp, total, vdate, card, holder, daysAgo] of ticketData) {
      await client.query(
        `INSERT INTO ticket_purchases
         (customer_id, user_id, ticket_type, adult_qty, child_qty,
          unit_price_adult, unit_price_child, total_price, visit_date,
          card_last_four, cardholder_name, purchase_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() - INTERVAL '${daysAgo} days')`,
        [customerIds[cidx], uidOffset, type, adults, children, ap, cp, total, vdate, card, holder]
      );
    }
    console.log(`  ✅ 12 ticket purchases created`);

    // ═══════════════════════════════════════════
    // RESTAURANTS
    // ═══════════════════════════════════════════
    console.log("\n🍔 Creating restaurants...\n");

    await client.query(`
      INSERT INTO restaurant (name, food_type, location, operational_status, total_sales, description, image_url)
      VALUES
        ('Cougar Grill', 'American', 'Zone A', 1, 12450.00, 'Classic American burgers, fries, and shakes. Outdoor seating with views of Thrill Alley.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800'),
        ('Panda Express', 'Asian', 'Zone B', 1, 9800.00, 'Quick-serve Asian favorites including orange chicken, fried rice, and lo mein.', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800'),
        ('Pizza Planet', 'Italian', 'Zone C', 1, 15200.00, 'Wood-fired pizzas, pasta, and garlic bread. Our most popular dining spot!', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800'),
        ('Snack Shack', 'Snacks & Drinks', 'Zone D', 1, 6300.00, 'Popcorn, pretzels, cotton candy, and refreshing drinks to keep you going.', 'https://images.unsplash.com/photo-1578946956088-940c3b502864?w=800'),
        ('The BBQ Pit', 'BBQ', 'Zone A', 0, 0.00, 'Slow-smoked brisket, ribs, and pulled pork. Currently closed for renovation.', 'https://images.unsplash.com/photo-1529193591184-b1d58069ecf0?w=800')
      ON CONFLICT DO NOTHING
    `);
    console.log("  ✅ 5 restaurants created");

    // ═══════════════════════════════════════════
    // GIFT SHOPS
    // ═══════════════════════════════════════════
    console.log("\n🎁 Creating gift shops...\n");

    await client.query(`
      INSERT INTO gift_shop (name, location, operational_status, total_sales, description, image_url)
      VALUES
        ('Main Street Gifts', 'Zone A', 1, 18900.00, 'The flagship CougarRide gift shop with the widest selection of apparel, souvenirs, and collectibles.', 'https://images.unsplash.com/photo-1513267048331-5611cad62e41?w=800'),
        ('Coaster Corner Store', 'Zone B', 1, 7600.00, 'Coaster-themed merchandise, ride photos, and exclusive Zone B souvenirs.', 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800'),
        ('Splash Zone Souvenirs', 'Zone C', 1, 5400.00, 'Ponchos, towels, waterproof phone cases, and water ride memorabilia.', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800')
      ON CONFLICT DO NOTHING
    `);
    console.log("  ✅ 3 gift shops created");

    // ═══════════════════════════════════════════
    // GAMES
    // ═══════════════════════════════════════════
    console.log("\n🎯 Creating games...\n");

    await client.query(`
      INSERT INTO game (game_name, max_players, location, operational_status, total_sales, description, image_url, prize_type)
      VALUES
        ('Ring Toss', 4, 'Zone A', 1, 3200.00, 'Toss rings onto bottles to win! Land three in a row for the grand prize.', '/rides/bumper-cars.jpg', 'Giant Stuffed Bear'),
        ('Balloon Darts', 2, 'Zone B', 1, 2800.00, 'Pop balloons with darts to reveal your prize. Every throw is a winner!', 'https://images.unsplash.com/photo-1527168027773-0cc890c4f42e?w=800', 'Goldfish in Bag'),
        ('Water Gun Race', 6, 'Zone C', 1, 4100.00, 'Race against friends by shooting water at your target. First to the top wins!', 'https://images.unsplash.com/photo-1504309092620-4d0ec726efa4?w=800', 'Plush Toy'),
        ('Basketball Shoot', 2, 'Zone D', 1, 1900.00, 'Sink baskets from the three-point line. Three in a row wins the grand prize!', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800', 'Sports Jersey'),
        ('Whack-a-Mole', 1, 'Zone A', 0, 0.00, 'Classic arcade fun! Whack as many moles as you can in 60 seconds.', 'https://images.unsplash.com/photo-1511882150382-421056c89033?w=800', 'Mini Plush')
      ON CONFLICT DO NOTHING
    `);
    console.log("  ✅ 5 games created");

    // ═══════════════════════════════════════════
    // MERCHANDISE
    // ═══════════════════════════════════════════
    console.log("\n🧸 Creating merchandise...\n");

    await client.query(`
      INSERT INTO merch (merch_name, merch_category, wholesale_price, retail_price, game_award, sold_location, sold_status)
      VALUES
        ('CougarRide T-Shirt', 'Apparel', 8.00, 24.99, false, 'Main Street Gifts', 1),
        ('Plush Cougar Mascot', 'Toys', 5.00, 19.99, false, 'Main Street Gifts', 1),
        ('Shot Glass Set', 'Souvenirs', 3.00, 12.99, false, 'Coaster Corner Store', 1),
        ('Park Map Poster', 'Souvenirs', 1.50, 7.99, false, 'Splash Zone Souvenirs', 1),
        ('Giant Stuffed Bear', 'Toys', 12.00, 0.00, true, 'Ring Toss', 1),
        ('Goldfish in Bag', 'Prizes', 2.00, 0.00, true, 'Balloon Darts', 1),
        ('CougarRide Hoodie', 'Apparel', 15.00, 44.99, false, 'Main Street Gifts', 1),
        ('Keychain Collection', 'Souvenirs', 1.00, 8.99, false, 'Coaster Corner Store', 1)
      ON CONFLICT DO NOTHING
    `);
    console.log("  ✅ 8 merchandise items created");

    // ═══════════════════════════════════════════
    // MAINTENANCE REQUESTS (will trigger notifications!)
    // ═══════════════════════════════════════════
    console.log("\n🔧 Creating maintenance requests...\n");
    console.log("  (Triggers will fire — generating notifications + ride status changes)\n");

    // Ride IDs from the database (dynamic lookup)
    const R = {
      COUGAR_EXPRESS: rideMap["Cougar Express"],
      THUNDER_CANYON: rideMap["Thunder Canyon"],
      SKY_SCREAMER: rideMap["Sky Screamer"],
      WILD_RIVER: rideMap["Wild River Rapids"],
      GALACTIC_SPINNER: rideMap["Galactic Spinner"],
      MINI_COASTER: rideMap["Mini Coaster"],
      FERRIS_WHEEL: rideMap["Ferris Wheel"],
      HAUNTED_MANSION: rideMap["Haunted Mansion"],
      BUMPER_CARS: rideMap["Bumper Cars"],
      DROP_TOWER: rideMap["Drop Tower"],
    };

    // Completed requests (older)
    await client.query(
      `INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '14 days')`,
      [R.COUGAR_EXPRESS, melanieEmp.employee_id, "Routine brake inspection — pads replaced", "Medium", "Completed"]
    );
    console.log("  ✅ Cougar Express — Completed brake inspection (Medium)");

    await client.query(
      `INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '10 days')`,
      [R.WILD_RIVER, nichEmp.employee_id, "Water pump seal replacement", "High", "Completed"]
    );
    console.log("  ✅ Wild River Rapids — Completed pump seal (High)");

    await client.query(
      `INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '7 days')`,
      [R.FERRIS_WHEEL, melanieEmp.employee_id, "LED lighting replacement on wheel spokes", "Low", "Completed"]
    );
    console.log("  ✅ Ferris Wheel — Completed LED replacement (Low)");

    // In Progress requests
    await client.query(
      `INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '2 days')`,
      [R.GALACTIC_SPINNER, nichEmp.employee_id, "Hydraulic cylinder leak on main arm", "High", "In Progress"]
    );
    console.log("  ✅ Galactic Spinner — In Progress hydraulic fix (High) → ride set to Maintenance");

    // Pending requests
    await client.query(
      `INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '1 day')`,
      [R.HAUNTED_MANSION, melanieEmp.employee_id, "Animatronic malfunction in Room 3", "Medium", "Pending"]
    );
    console.log("  ✅ Haunted Mansion — Pending animatronic fix (Medium)");

    // Critical request (will trigger safety lockout + manager notification)
    await client.query(
      `INSERT INTO maintenance_requests (ride_id, employee_id, description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '3 hours')`,
      [R.SKY_SCREAMER, nichEmp.employee_id, "Structural crack detected on support beam — ride unsafe", "Critical", "Pending"]
    );
    console.log("  ✅ Sky Screamer — CRITICAL structural crack → ride CLOSED + managers notified");

    console.log("\n═══════════════════════════════════════════");
    console.log("✅ SEED COMPLETE!");
    console.log("═══════════════════════════════════════════\n");
    console.log("Login credentials (all use password: CougarRide2026!):\n");
    console.log("  Admin:   alex.rivera@cougarride.com");
    console.log("  Manager: srinath.satuluri@cougarride.com");
    console.log("  Staff:   melanie.cura@cougarride.com");
    console.log("  Staff:   nicholaus.mayes@cougarride.com");
    console.log("  Customer: maria.garcia@email.com");
    console.log("  Customer: james.wilson@email.com");
    console.log("  Customer: sarah.johnson@email.com");
    console.log("  Customer: david.lee@email.com");
    console.log("  Customer: emily.chen@email.com");
    console.log("");

  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

resetAndSeed();