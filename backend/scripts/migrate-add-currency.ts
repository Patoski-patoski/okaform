/**
 * One-time migration script to backfill existing forms with the new
 * currency fields added for USDC support.
 *
 * Sets rewardCurrency='SOL', tokenMint='', tokenDecimals=9 on all existing forms.
 * Copies grossRewardPoolLamports → grossRewardPoolUnits, etc.
 *
 * Usage: cd backend && npx tsx scripts/migrate-add-currency.ts
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env['MONGO_URI'];
if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in .env');
  process.exit(1);
}

interface FormDoc {
  _id: mongoose.Types.ObjectId;
  rewardCurrency?: string;
  grossRewardPoolLamports?: number;
  netRewardPoolLamports?: number;
  feeLamports?: number;
}

async function migrate(): Promise<void> {
  const conn = await mongoose.connect(MONGO_URI as string);
  const db = conn.connection.db;

  if (!db) {
    console.error('Failed to get database reference');
    process.exit(1);
  }

  const formsCollection = db.collection('forms');

  // Find all forms that don't have rewardCurrency set
  const cursor = formsCollection.find({
    $or: [
      { rewardCurrency: { $exists: false } },
      { rewardCurrency: null },
      { rewardCurrency: '' },
    ],
  });

  let updated = 0;
  const docs = await cursor.toArray();

  for (const doc of docs) {
    const formDoc = doc as unknown as FormDoc;
    await formsCollection.updateOne(
      { _id: formDoc._id },
      {
        $set: {
          rewardCurrency: 'SOL',
          tokenMint: '',
          tokenDecimals: 9,
          grossRewardPoolUnits: formDoc.grossRewardPoolLamports ?? 0,
          netRewardPoolUnits: formDoc.netRewardPoolLamports ?? 0,
          feeUnits: formDoc.feeLamports ?? 0,
        },
      },
    );
    updated++;
  }

  console.log(`Migration complete. Updated ${updated} forms.`);

  // Also backfill distribution records
  const distCollection = db.collection('distribution_records');
  const distCursor = distCollection.find({
    $or: [
      { rewardCurrency: { $exists: false } },
      { rewardCurrency: null },
      { amountUnits: { $exists: false } },
      { amountUnits: 0 },
    ],
  });

  const distDocs = await distCursor.toArray();
  let distUpdated = 0;

  for (const doc of distDocs) {
    await distCollection.updateOne(
      { _id: doc._id },
      {
        $set: {
          rewardCurrency: doc['rewardCurrency'] || 'SOL',
          amountUnits: doc['amountUnits'] || doc['amountLamports'] || 0,
        },
      },
    );
    distUpdated++;
  }

  console.log(`Distribution records: updated ${distUpdated} records.`);

  await mongoose.disconnect();
}

migrate().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
