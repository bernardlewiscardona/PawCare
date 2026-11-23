/**
 * ERD section 3 — household inventory ledger (IN-01–IN-04).
 */
import {
  PgError,
  checkDeferred,
  closePool,
  createInventoryItem,
  createOwner,
  createPet,
  createStockedBatch,
  expectViolation,
  inRolledBackTx,
  insert,
  unique,
  type Db,
  type Row,
} from './db/db-test-helpers.js';

afterAll(async () => {
  await closePool();
});

async function ownerWithItem(db: Db, overrides: Row = {}) {
  const owner = await createOwner(db);
  const item = await createInventoryItem(db, owner.id, overrides);
  return { owner, item };
}

function transaction(db: Db, item: Row, type: string, extra: Row = {}) {
  return insert(db, 'stock_transactions', {
    owner_id: item.owner_id,
    item_id: item.id,
    type,
    request_key: unique('req'),
    ...extra,
  });
}

function entry(db: Db, tx: Row, batch: Row, signed_quantity: string) {
  return insert(db, 'stock_entries', {
    owner_id: tx.owner_id,
    item_id: tx.item_id,
    transaction_id: tx.id,
    transaction_type: tx.type,
    batch_id: batch.id,
    signed_quantity,
  });
}

async function setBalance(db: Db, batch: Row, quantity: string) {
  await db.query('UPDATE stock_batches SET remaining_quantity = $1 WHERE id = $2', [
    quantity,
    batch.id,
  ]);
}

describe('inventory_items', () => {
  it('offers an expiry lead of 7 or 30 days', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      await expectViolation(db, () => createInventoryItem(db, owner.id, { expiry_lead_days: 14 }), {
        code: PgError.CHECK,
        constraint: 'inventory_items_expiry_lead_days_check',
      });
      await createInventoryItem(db, owner.id, { expiry_lead_days: 30 });
    }));

  it('needs whole-number thresholds for discrete units', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      await expectViolation(
        db,
        () => createInventoryItem(db, owner.id, { unit: 'TABLET', low_stock_threshold: '2.5' }),
        { code: PgError.CHECK, constraint: 'inventory_items_low_stock_threshold_check' },
      );
      await createInventoryItem(db, owner.id, { unit: 'GRAM', low_stock_threshold: '2.5' });
    }));

  it('keeps the unit immutable', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      await expectViolation(
        db,
        () => db.query("UPDATE inventory_items SET unit = 'MILLILITER' WHERE id = $1", [item.id]),
        { code: PgError.RAISED, message: /unit .* cannot change/i },
      );
    }));
});

describe('inventory_pets', () => {
  it("links only the same owner's pets", () =>
    inRolledBackTx(async (db) => {
      const { owner, item } = await ownerWithItem(db);
      const stranger = await createOwner(db);
      const strangersPet = await createPet(db, stranger.id);
      await expectViolation(
        db,
        () =>
          insert(db, 'inventory_pets', {
            owner_id: owner.id,
            item_id: item.id,
            pet_id: strangersPet.id,
          }),
        { code: PgError.FOREIGN_KEY, constraint: /pet_id/ },
      );
    }));
});

describe('stock ledger', () => {
  it('creates a zero opening balance (OPENING may be 0)', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      await createStockedBatch(db, item, '0');
      await checkDeferred(db);
    }));

  it('scopes request keys per owner', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      const other = await ownerWithItem(db);
      const key = unique('req');
      await transaction(db, item, 'RESTOCK', { request_key: key });
      await transaction(db, other.item, 'RESTOCK', { request_key: key });
      await expectViolation(db, () => transaction(db, item, 'USE', { request_key: key }), {
        code: PgError.UNIQUE,
        constraint: /request_key/,
      });
    }));

  it('applies the sign rules for each transaction type', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      const { batch } = await createStockedBatch(db, item, '10');
      const cases: Array<[string, string]> = [
        ['RESTOCK', '-1'],
        ['RESTOCK', '0'],
        ['USE', '1'],
        ['DISPOSE', '1'],
        ['ADJUST', '0'],
        ['OPENING', '-1'],
      ];
      for (const [type, qty] of cases) {
        const reason = type === 'DISPOSE' || type === 'ADJUST' ? { reason: 'Count error' } : {};
        const tx = await transaction(db, item, type, reason);
        await expectViolation(db, () => entry(db, tx, batch, qty), {
          code: PgError.CHECK,
          constraint: 'stock_entries_signed_quantity_check',
        });
      }
    }));

  it('requires a reason for disposals and adjustments', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      for (const type of ['DISPOSE', 'ADJUST']) {
        await expectViolation(db, () => transaction(db, item, type), {
          code: PgError.CHECK,
          constraint: 'stock_transactions_reason_check',
        });
      }
    }));

  it("moves stock only in the transaction's own item batches", () =>
    inRolledBackTx(async (db) => {
      const { owner, item } = await ownerWithItem(db);
      const otherItem = await createInventoryItem(db, owner.id, { name: 'Treats' });
      const { batch: otherBatch } = await createStockedBatch(db, otherItem, '5');
      const tx = await transaction(db, item, 'RESTOCK');
      await expectViolation(db, () => entry(db, tx, otherBatch, '1'), {
        code: PgError.FOREIGN_KEY,
        constraint: /batch_id/,
      });
    }));

  it('never lets a batch go negative', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      const { batch } = await createStockedBatch(db, item, '1');
      await expectViolation(db, () => setBalance(db, batch, '-1'), {
        code: PgError.CHECK,
        constraint: 'stock_batches_remaining_quantity_check',
      });
    }));

  it('keeps each batch balance equal to the sum of its entries at commit', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      const { batch } = await createStockedBatch(db, item, '10');
      await expectViolation(db, () => setBalance(db, batch, '9'), {
        code: PgError.RAISED,
        message: /balance .* does not match its ledger/i,
      });
      const use = await transaction(db, item, 'USE');
      await entry(db, use, batch, '-4');
      await setBalance(db, batch, '6');
      await checkDeferred(db);
    }));

  it('is immutable once written', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      const { transaction: tx, entry: e } = await createStockedBatch(db, item, '3');
      await expectViolation(
        db,
        () => db.query("UPDATE stock_transactions SET reason = 'edited' WHERE id = $1", [tx.id]),
        { code: PgError.RAISED, message: /stock ledger is immutable/i },
      );
      await expectViolation(
        db,
        () => db.query("UPDATE stock_entries SET signed_quantity = '4' WHERE id = $1", [e.id]),
        { code: PgError.RAISED, message: /stock ledger is immutable/i },
      );
    }));

  it('reverses a transaction at most once, within the same item', () =>
    inRolledBackTx(async (db) => {
      const { owner, item } = await ownerWithItem(db);
      const { transaction: restock } = await createStockedBatch(db, item, '3', {}, 'RESTOCK');
      await expectViolation(db, () => transaction(db, item, 'REVERSE'), {
        code: PgError.CHECK,
        constraint: 'stock_transactions_reversal_check',
      });
      await expectViolation(
        db,
        () => transaction(db, item, 'USE', { reverses_transaction_id: restock.id }),
        { code: PgError.CHECK, constraint: 'stock_transactions_reversal_check' },
      );
      const otherItem = await createInventoryItem(db, owner.id, { name: 'Treats' });
      await expectViolation(
        db,
        () => transaction(db, otherItem, 'REVERSE', { reverses_transaction_id: restock.id }),
        { code: PgError.FOREIGN_KEY, constraint: /reverses_transaction_id/ },
      );
      await transaction(db, item, 'REVERSE', { reverses_transaction_id: restock.id });
      await expectViolation(
        db,
        () => transaction(db, item, 'REVERSE', { reverses_transaction_id: restock.id }),
        { code: PgError.UNIQUE, constraint: /reverses_transaction_id/ },
      );
    }));
});

describe('inventory_alerts', () => {
  function alert(db: Db, item: Row, type: string, extra: Row = {}) {
    return insert(db, 'inventory_alerts', {
      owner_id: item.owner_id,
      item_id: item.id,
      type,
      episode_number: 1,
      ...extra,
    });
  }

  it('ties expiry alerts to a batch and low-stock alerts to the item only', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      const { batch } = await createStockedBatch(db, item, '1');
      await expectViolation(db, () => alert(db, item, 'EXPIRING'), {
        code: PgError.CHECK,
        constraint: 'inventory_alerts_batch_check',
      });
      await expectViolation(db, () => alert(db, item, 'LOW_STOCK', { batch_id: batch.id }), {
        code: PgError.CHECK,
        constraint: 'inventory_alerts_batch_check',
      });
    }));

  it('keeps one open low-stock episode per item', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      const first = await alert(db, item, 'LOW_STOCK');
      await expectViolation(db, () => alert(db, item, 'LOW_STOCK', { episode_number: 2 }), {
        code: PgError.UNIQUE,
        constraint: 'inventory_alerts_one_open_low_stock_key',
      });
      await db.query('UPDATE inventory_alerts SET resolved_at = now() WHERE id = $1', [first.id]);
      await alert(db, item, 'LOW_STOCK', { episode_number: 2 });
    }));

  it('raises each expiry alert type once per batch', () =>
    inRolledBackTx(async (db) => {
      const { item } = await ownerWithItem(db);
      const { batch } = await createStockedBatch(db, item, '1');
      await alert(db, item, 'EXPIRING', { batch_id: batch.id });
      await alert(db, item, 'EXPIRED', { batch_id: batch.id });
      await expectViolation(db, () => alert(db, item, 'EXPIRING', { batch_id: batch.id }), {
        code: PgError.UNIQUE,
        constraint: /batch_id_type/,
      });
    }));
});
