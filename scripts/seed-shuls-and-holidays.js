require('dotenv').config();
const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 5 realistic Toronto shuls with [TEST] prefix
const testShuls = [
  {
    name: "[TEST] Beth Jacob V'Anshei Drildz",
    slug: "test-beth-jacob-drildz",
    description: "A warm and welcoming Orthodox shul serving the Bathurst & Lawrence community for over 50 years. Known for its friendly atmosphere and strong sense of community.",
    address: "239 Wilson Ave",
    city: "Toronto",
    postalCode: "M5M 3A9",
    phone: "(416) 633-5500",
    email: "office@bethjacob.ca",
    website: "https://bethjacob.ca",
    rabbi: "Rabbi Yitzchok Grossman",
    denomination: "orthodox",
    nusach: "ashkenaz",
    hasMinyan: true,
  },
  {
    name: "[TEST] Chabad of Midtown",
    slug: "test-chabad-midtown",
    description: "Chabad of Midtown offers a warm, non-judgmental environment for Jews of all backgrounds. Join us for Shabbat services, classes, and community events.",
    address: "59 Yorkville Ave",
    city: "Toronto",
    postalCode: "M5R 1B8",
    phone: "(416) 516-2005",
    email: "info@chabadmidtown.com",
    website: "https://chabadmidtown.com",
    rabbi: "Rabbi Zalman Grossbaum",
    denomination: "chabad",
    nusach: "ari",
    hasMinyan: true,
  },
  {
    name: "[TEST] Shaarei Shomayim Congregation",
    slug: "test-shaarei-shomayim",
    description: "One of Toronto's premier Modern Orthodox synagogues, Shaarei Shomayim has been serving the community since 1930. We offer diverse programming for all ages.",
    address: "470 Glencairn Ave",
    city: "Toronto",
    postalCode: "M5N 1V8",
    phone: "(416) 789-3213",
    email: "office@shaareishomayim.com",
    website: "https://shaareishomayim.com",
    rabbi: "Rabbi Chaim Strauchler",
    denomination: "modern-orthodox",
    nusach: "ashkenaz",
    hasMinyan: true,
  },
  {
    name: "[TEST] Sephardic Kehila Centre",
    slug: "test-sephardic-kehila",
    description: "The Sephardic Kehila Centre serves Toronto's vibrant Sephardic community with services, shiurim, and cultural events that preserve our rich heritage.",
    address: "7026 Bathurst St",
    city: "Thornhill",
    postalCode: "L4J 8K3",
    phone: "(905) 669-7760",
    email: "info@kehila.ca",
    website: "https://kehila.ca",
    rabbi: "Rabbi David Kadoch",
    denomination: "sephardic",
    nusach: "edot-hamizrach",
    hasMinyan: true,
  },
  {
    name: "[TEST] Clanton Park Synagogue",
    slug: "test-clanton-park",
    description: "A family-friendly Orthodox shul in the heart of the Bathurst corridor. We pride ourselves on our warm davening and strong youth programming.",
    address: "20 Rockford Rd",
    city: "Toronto",
    postalCode: "M2R 3A2",
    phone: "(416) 223-4464",
    email: "office@clantonpark.com",
    website: "https://clantonpark.com",
    rabbi: "Rabbi Baruch Taub",
    denomination: "orthodox",
    nusach: "ashkenaz",
    hasMinyan: true,
  },
];

// Jewish holiday events around Feb 23, 2026 (Purim is March 3, 2026)
function generateHolidayEvents(shulId, shulName) {
  return [
    {
      title: `[TEST] Ta'anit Esther - Fast Day`,
      description: `Join ${shulName} for the Fast of Esther. Mincha with Megillah reading to follow at night.`,
      startTime: new Date('2026-03-02T06:00:00'),
      endTime: new Date('2026-03-02T19:30:00'),
      isAllDay: false,
      eventType: 'community',
      shulId,
      location: shulName,
    },
    {
      title: `[TEST] Purim Megillah Reading - Night`,
      description: `Come hear the Megillah reading at ${shulName}. Costumes encouraged! Refreshments will be served.`,
      startTime: new Date('2026-03-02T19:30:00'),
      endTime: new Date('2026-03-02T21:00:00'),
      isAllDay: false,
      eventType: 'community',
      shulId,
      location: shulName,
    },
    {
      title: `[TEST] Purim Shacharis & Megillah`,
      description: `Morning Megillah reading at ${shulName}. Multiple readings available.`,
      startTime: new Date('2026-03-03T07:00:00'),
      endTime: new Date('2026-03-03T09:30:00'),
      isAllDay: false,
      eventType: 'community',
      shulId,
      location: shulName,
    },
    {
      title: `[TEST] Purim Seudah`,
      description: `Celebrate Purim with a festive seudah at ${shulName}. Music, food, and celebration!`,
      startTime: new Date('2026-03-03T13:00:00'),
      endTime: new Date('2026-03-03T17:00:00'),
      isAllDay: false,
      eventType: 'community',
      shulId,
      location: shulName,
      cost: '$25 per person, $75 family max',
    },
    {
      title: `[TEST] Kids Purim Carnival`,
      description: `Fun for the whole family! Games, prizes, hamantaschen, and more at ${shulName}.`,
      startTime: new Date('2026-03-03T10:00:00'),
      endTime: new Date('2026-03-03T12:30:00'),
      isAllDay: false,
      eventType: 'community',
      shulId,
      location: shulName,
      cost: '$10 per child',
    },
  ];
}

async function seedData() {
  const client = await pgPool.connect();

  try {
    console.log('Seeding test shuls and holiday events...\n');

    // Insert shuls
    const insertedShuls = [];
    for (const shul of testShuls) {
      const result = await client.query(
        `INSERT INTO shuls (name, slug, description, address, city, postal_code, phone, email, website, rabbi, denomination, nusach, has_minyan, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW())
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name`,
        [
          shul.name, shul.slug, shul.description, shul.address, shul.city,
          shul.postalCode, shul.phone, shul.email, shul.website, shul.rabbi,
          shul.denomination, shul.nusach, shul.hasMinyan
        ]
      );
      insertedShuls.push(result.rows[0]);
      console.log(`✓ Created shul: ${result.rows[0].name}`);
    }

    console.log(`\nInserted ${insertedShuls.length} shuls.\n`);

    // Insert holiday events for each shul
    let eventCount = 0;
    for (const shul of insertedShuls) {
      const events = generateHolidayEvents(shul.id, shul.name.replace('[TEST] ', ''));

      for (const event of events) {
        await client.query(
          `INSERT INTO events (title, description, start_time, end_time, is_all_day, event_type, shul_id, location, cost, approval_status, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved', true, NOW())`,
          [
            event.title, event.description, event.startTime, event.endTime,
            event.isAllDay, event.eventType, event.shulId, event.location, event.cost || null
          ]
        );
        eventCount++;
      }
      console.log(`✓ Created ${events.length} Purim events for ${shul.name}`);
    }

    console.log('\n============================================');
    console.log('SEEDING COMPLETE');
    console.log('============================================');
    console.log(`Shuls created: ${insertedShuls.length}`);
    console.log(`Events created: ${eventCount}`);
    console.log('\nTo clean up test data:');
    console.log("  DELETE FROM events WHERE title LIKE '[TEST]%';");
    console.log("  DELETE FROM shuls WHERE name LIKE '[TEST]%';");

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    client.release();
    await pgPool.end();
  }
}

seedData();
