/**
 * ERD section 1 — ownership and health records (FN-01, PF-01–PF-04, MR-01–MR-04).
 * Asserts the database itself enforces the rules from docs/design/erd-and-flows.md.
 */
import {
  PgError,
  checkDeferred,
  closePool,
  createCareRecord,
  createFileAsset,
  createOwner,
  createPet,
  expectViolation,
  inRolledBackTx,
  insert,
} from './db/db-test-helpers.js';

afterAll(async () => {
  await closePool();
});

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('identifiers (D-ERD-4)', () => {
  it('generates time-ordered UUIDv7 primary keys in the database', () =>
    inRolledBackTx(async (db) => {
      const first = await createOwner(db);
      const second = await createOwner(db);
      expect(first.id).toMatch(UUID_V7);
      expect(second.id).toMatch(UUID_V7);
      expect((second.id as string) > (first.id as string)).toBe(true);
    }));

  it('starts every mutable record at version 1 with timestamps', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      for (const row of [owner, pet]) {
        expect(row.version).toBe(1);
        expect(row.created_at).toBeInstanceOf(Date);
        expect(row.updated_at).toBeInstanceOf(Date);
      }
    }));
});

describe('owners', () => {
  it('defaults the account to ACTIVE', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      expect(owner.account_status).toBe('ACTIVE');
    }));

  it('allows one owner per auth subject', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      await expectViolation(db, () => createOwner(db, { auth_subject: owner.auth_subject }), {
        code: PgError.UNIQUE,
        constraint: /auth_subject/,
      });
    }));

  it('requires a display name of 1–100 trimmed characters', () =>
    inRolledBackTx(async (db) => {
      for (const display_name of ['   ', 'x'.repeat(101)]) {
        await expectViolation(db, () => createOwner(db, { display_name }), {
          code: PgError.CHECK,
          constraint: 'owners_display_name_check',
        });
      }
      await createOwner(db, { display_name: 'x'.repeat(100) });
    }));

  it("rejects another owner's file as an avatar", () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const stranger = await createOwner(db);
      const strangersImage = await createFileAsset(db, stranger.id, {
        purpose: 'OWNER_AVATAR',
        mime_type: 'image/png',
      });
      await expectViolation(
        db,
        () =>
          db.query('UPDATE owners SET avatar_asset_id = $1 WHERE id = $2', [
            strangersImage.id,
            owner.id,
          ]),
        { code: PgError.FOREIGN_KEY, constraint: /avatar_asset_id/ },
      );
    }));
});

describe('file_assets', () => {
  it('starts in PENDING_UPLOAD so a pending file can be shown on its record', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const asset = await createFileAsset(db, owner.id);
      expect(asset.scan_status).toBe('PENDING_UPLOAD');
    }));

  it('accepts only JPEG, PNG and PDF', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      await expectViolation(db, () => createFileAsset(db, owner.id, { mime_type: 'image/gif' }), {
        code: PgError.CHECK,
        constraint: 'file_assets_mime_type_check',
      });
    }));

  it('limits files to 1 byte–10 MB', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      for (const size_bytes of [0, 10 * 1024 * 1024 + 1]) {
        await expectViolation(db, () => createFileAsset(db, owner.id, { size_bytes }), {
          code: PgError.CHECK,
          constraint: 'file_assets_size_bytes_check',
        });
      }
      await createFileAsset(db, owner.id, { size_bytes: 10 * 1024 * 1024 });
    }));

  it('requires an image type for pet photos and avatars', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      await expectViolation(
        db,
        () => createFileAsset(db, owner.id, { purpose: 'PET_PHOTO', mime_type: 'application/pdf' }),
        { code: PgError.CHECK, constraint: 'file_assets_profile_image_check' },
      );
    }));

  it('never reuses an object key', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const asset = await createFileAsset(db, owner.id);
      await expectViolation(
        db,
        () => createFileAsset(db, owner.id, { object_key: asset.object_key }),
        { code: PgError.UNIQUE, constraint: /object_key/ },
      );
    }));
});

describe('pets', () => {
  it('requires a description only when the species is Other', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      await expectViolation(db, () => createPet(db, owner.id, { species: 'OTHER' }), {
        code: PgError.CHECK,
        constraint: 'pets_species_other_check',
      });
      await expectViolation(
        db,
        () => createPet(db, owner.id, { species: 'DOG', species_other: 'Wolf' }),
        { code: PgError.CHECK, constraint: 'pets_species_other_check' },
      );
      await createPet(db, owner.id, { species: 'OTHER', species_other: 'Tortoise' });
    }));

  it('defaults sex to UNKNOWN and requires a 1–100 character name', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      expect(pet.sex).toBe('UNKNOWN');
      await expectViolation(db, () => createPet(db, owner.id, { name: '  ' }), {
        code: PgError.CHECK,
        constraint: 'pets_name_check',
      });
    }));

  it('keeps weight above 0 and at most 1,000 kg', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      for (const current_weight_kg of ['0', '1000.001']) {
        await expectViolation(db, () => createPet(db, owner.id, { current_weight_kg }), {
          code: PgError.CHECK,
          constraint: 'pets_current_weight_kg_check',
        });
      }
      await createPet(db, owner.id, { current_weight_kg: '1000' });
    }));

  it('marks a birth date estimated only when one is given', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      await expectViolation(db, () => createPet(db, owner.id, { birth_date_estimated: true }), {
        code: PgError.CHECK,
        constraint: 'pets_birth_date_estimated_check',
      });
    }));

  it("rejects another owner's file as a pet photo", () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const stranger = await createOwner(db);
      const photo = await createFileAsset(db, stranger.id, {
        purpose: 'PET_PHOTO',
        mime_type: 'image/jpeg',
      });
      await expectViolation(db, () => createPet(db, owner.id, { photo_asset_id: photo.id }), {
        code: PgError.FOREIGN_KEY,
        constraint: /photo_asset_id/,
      });
    }));

  it('allows duplicate pet names and microchips (not globally unique)', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      await createPet(db, owner.id, { microchip: '985112345678901' });
      await createPet(db, owner.id, { microchip: '985112345678901' });
    }));

  it('cannot be deleted while it has care history (no cascades)', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      await createCareRecord(db, 'MEDICAL', owner.id, pet.id);
      await expectViolation(db, () => db.query('DELETE FROM pets WHERE id = $1', [pet.id]), {
        code: PgError.FOREIGN_KEY,
      });
    }));
});

describe('care_records', () => {
  it("cannot reference another owner's pet", () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const stranger = await createOwner(db);
      const strangersPet = await createPet(db, stranger.id);
      await expectViolation(db, () => createCareRecord(db, 'MEDICAL', owner.id, strangersPet.id), {
        code: PgError.FOREIGN_KEY,
        constraint: /owner_id_pet_id/,
      });
    }));

  it('defaults to ACTIVE and Owner-entered provenance', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      const record = await createCareRecord(db, 'MEDICAL', owner.id, pet.id);
      expect(record.parent).toMatchObject({ status: 'ACTIVE', provenance: 'OWNER_ENTERED' });
    }));

  it('requires a matching subtype row by commit time', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      await expectViolation(
        db,
        () =>
          insert(db, 'care_records', {
            owner_id: owner.id,
            pet_id: pet.id,
            kind: 'VACCINE',
            occurrence_date: '2026-10-01',
          }),
        { code: PgError.RAISED, message: /care record .* has no VACCINE subtype/i },
      );
    }));

  it('rejects a subtype row whose kind does not match the parent', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      const vaccine = await createCareRecord(db, 'VACCINE', owner.id, pet.id);
      await expectViolation(
        db,
        () =>
          insert(db, 'medical_events', {
            record_id: vaccine.id,
            owner_id: owner.id,
            pet_id: pet.id,
            event_type: 'VISIT',
            title: 'Mismatched',
          }),
        { code: PgError.FOREIGN_KEY },
      );
    }));

  it('requires a 1–500 character reason and a timestamp to void', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      const record = await createCareRecord(db, 'MEDICAL', owner.id, pet.id);
      const voidWith = (reason: string | null, at: string | null) => () =>
        db.query(
          "UPDATE care_records SET status = 'VOIDED', void_reason = $1, voided_at = $2 WHERE id = $3",
          [reason, at, record.id],
        );
      await expectViolation(db, voidWith(null, '2026-11-01T00:00:00Z'), {
        code: PgError.CHECK,
        constraint: 'care_records_void_check',
      });
      await expectViolation(db, voidWith('x'.repeat(501), '2026-11-01T00:00:00Z'), {
        code: PgError.CHECK,
        constraint: 'care_records_void_check',
      });
      await voidWith('Entered for the wrong pet', '2026-11-01T00:00:00Z')();
    }));

  it('never voids an appointment', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      const visit = await createCareRecord(db, 'APPOINTMENT', owner.id, pet.id);
      await expectViolation(
        db,
        () =>
          db.query(
            "UPDATE care_records SET status = 'VOIDED', void_reason = 'x', voided_at = now() WHERE id = $1",
            [visit.id],
          ),
        { code: PgError.CHECK, constraint: 'care_records_appointment_not_voided_check' },
      );
    }));

  it('keeps the pet association fixed once the subtype exists', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      const otherPet = await createPet(db, owner.id);
      const record = await createCareRecord(db, 'APPOINTMENT', owner.id, pet.id);
      await expectViolation(
        db,
        () =>
          db.query('UPDATE care_records SET pet_id = $1 WHERE id = $2', [otherPet.id, record.id]),
        { code: PgError.FOREIGN_KEY },
      );
    }));
});

describe('medical_events', () => {
  it('requires a 1–150 character title and limits notes to 5,000 characters', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      await expectViolation(
        db,
        () => createCareRecord(db, 'MEDICAL', owner.id, pet.id, { title: ' ' }),
        { code: PgError.CHECK, constraint: 'medical_events_title_check' },
      );
      await expectViolation(
        db,
        () => createCareRecord(db, 'MEDICAL', owner.id, pet.id, { notes: 'x'.repeat(5001) }),
        { code: PgError.CHECK, constraint: /medical_events_notes/ },
      );
    }));

  it('links only to an appointment of the same owner and pet', () =>
    inRolledBackTx(async (db) => {
      const owner = await createOwner(db);
      const pet = await createPet(db, owner.id);
      const otherPet = await createPet(db, owner.id);
      const otherPetsVisit = await createCareRecord(db, 'APPOINTMENT', owner.id, otherPet.id);
      await expectViolation(
        db,
        () =>
          createCareRecord(db, 'MEDICAL', owner.id, pet.id, { appointment_id: otherPetsVisit.id }),
        { code: PgError.FOREIGN_KEY, constraint: /appointment_id/ },
      );
      const visit = await createCareRecord(db, 'APPOINTMENT', owner.id, pet.id);
      await createCareRecord(db, 'MEDICAL', owner.id, pet.id, { appointment_id: visit.id });
      await checkDeferred(db);
    }));
});

describe('attachments', () => {
  async function setup(db: Parameters<typeof createOwner>[0]) {
    const owner = await createOwner(db);
    const pet = await createPet(db, owner.id);
    const asset = await createFileAsset(db, owner.id);
    return { owner, pet, asset };
  }

  it('attach to medical, vaccine and prescription records only', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet, asset } = await setup(db);
      const visit = await createCareRecord(db, 'APPOINTMENT', owner.id, pet.id);
      await expectViolation(
        db,
        () =>
          insert(db, 'attachments', {
            owner_id: owner.id,
            record_id: visit.id,
            record_kind: 'APPOINTMENT',
            file_asset_id: asset.id,
          }),
        { code: PgError.CHECK, constraint: 'attachments_record_kind_check' },
      );
    }));

  it('cannot claim a kind the record does not have', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet, asset } = await setup(db);
      const vaccine = await createCareRecord(db, 'VACCINE', owner.id, pet.id);
      await expectViolation(
        db,
        () =>
          insert(db, 'attachments', {
            owner_id: owner.id,
            record_id: vaccine.id,
            record_kind: 'MEDICAL',
            file_asset_id: asset.id,
          }),
        { code: PgError.FOREIGN_KEY },
      );
    }));

  it('use each file asset at most once', () =>
    inRolledBackTx(async (db) => {
      const { owner, pet, asset } = await setup(db);
      const a = await createCareRecord(db, 'MEDICAL', owner.id, pet.id);
      const b = await createCareRecord(db, 'MEDICAL', owner.id, pet.id);
      const attach = (recordId: string) =>
        insert(db, 'attachments', {
          owner_id: owner.id,
          record_id: recordId,
          record_kind: 'MEDICAL',
          file_asset_id: asset.id,
        });
      await attach(a.id);
      await expectViolation(db, () => attach(b.id), {
        code: PgError.UNIQUE,
        constraint: /file_asset_id/,
      });
    }));

  it("cannot link another owner's file", () =>
    inRolledBackTx(async (db) => {
      const { owner, pet } = await setup(db);
      const stranger = await createOwner(db);
      const strangersFile = await createFileAsset(db, stranger.id);
      const record = await createCareRecord(db, 'MEDICAL', owner.id, pet.id);
      await expectViolation(
        db,
        () =>
          insert(db, 'attachments', {
            owner_id: owner.id,
            record_id: record.id,
            record_kind: 'MEDICAL',
            file_asset_id: strangersFile.id,
          }),
        { code: PgError.FOREIGN_KEY, constraint: /file_asset_id/ },
      );
    }));
});
