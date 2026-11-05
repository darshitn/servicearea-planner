import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MongoClient, ObjectId } from 'mongodb';

export function localDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

// Fictional assignments for a single coordinator's day in Bengaluru.
const visits = [
  {
    key: 'cedar-lift', customer: 'Cedar Court Apartments', service: 'Lift safety inspection',
    area: 'Indiranagar', address: '18, 6th Main Road', staff: 'Kiran Rao',
    startTime: '08:30', endTime: '09:30', status: 'Completed',
    notes: 'Tested the emergency alarm and door sensors. Logged readings with the caretaker.',
  },
  {
    key: 'fern-plumbing', customer: 'Fern House', service: 'Kitchen leak repair',
    area: 'Indiranagar', address: '42, 12th Cross Road', staff: 'Meera Nair',
    startTime: '10:00', endTime: '11:00', status: 'In progress', notes: '',
  },
  {
    key: 'park-ac', customer: 'Park Lane Studio', service: 'Air conditioner service',
    area: 'Indiranagar', address: '7, 2nd Main Road', staff: 'Kiran Rao',
    startTime: '13:00', endTime: '14:00', status: 'Scheduled', notes: '',
  },
  {
    key: 'banyan-pump', customer: 'Banyan Residences', service: 'Water pump inspection',
    area: 'Domlur', address: '23, Layout Road', staff: 'Sana Ahmed',
    startTime: '09:00', endTime: '10:00', status: 'Completed',
    notes: 'Cleared the inlet filter and verified pressure at the overhead tank.',
  },
  {
    key: 'clay-electrical', customer: 'Clay Cup Café', service: 'Socket replacement',
    area: 'Domlur', address: '11, 1st Stage Main Road', staff: 'Sana Ahmed',
    startTime: '11:30', endTime: '12:30', status: 'Scheduled', notes: '',
  },
  {
    key: 'lake-lighting', customer: 'Lakeview Reading Room', service: 'Lighting repair',
    area: 'Ulsoor', address: '36, Tank Road', staff: 'Meera Nair',
    startTime: '15:00', endTime: '16:00', status: 'Scheduled', notes: '',
  },
];

export function seedDemo(db, date = localDate()) {
  const operations = visits.map(({ key, ...visit }) => {
    // Stable, namespaced IDs preserve later edits and make repeat runs safe for the same date.
    const hex = createHash('sha256').update(`servicearea-demo-v1/${date}/${key}`).digest('hex');
    return {
      updateOne: {
        filter: { _id: new ObjectId(hex.slice(0, 24)) },
        update: { $setOnInsert: { ...visit, date } },
        upsert: true,
      },
    };
  });
  return db.collection('workOrders').bulkWrite(operations);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/servicearea_planner';
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const date = localDate();
    const result = await seedDemo(client.db(process.env.MONGODB_DB || undefined), date);
    console.log(`Demo data for ${date}: ${result.upsertedCount} inserted, ${result.matchedCount} already present.`);
  } catch (error) {
    console.error(`Could not seed the demo. Check MongoDB connectivity and database permissions (${error.name}).`);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
