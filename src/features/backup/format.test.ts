import { backupFileName, BackupError, checkHeader, decideSchema, MAX_BACKUP_BYTES, SQLITE_APPLICATION_ID } from './format';

/** Un en-tête SQLite de 100 octets : page de 4096 octets, `pages` pages annoncées, identité Sovmilo (ou autre). */
function header({ pages = 3, applicationId = SQLITE_APPLICATION_ID, length }: { pages?: number; applicationId?: number; length?: number } = {}): Uint8Array {
  const bytes = new Uint8Array(length ?? pages * 4096);
  'SQLite format 3\u0000'.split('').forEach((char, index) => {
    bytes[index] = char.charCodeAt(0);
  });
  const view = new DataView(bytes.buffer);
  view.setUint16(16, 4096);
  view.setUint32(24, 7); // compteur de modifications
  view.setUint32(28, pages);
  view.setUint32(68, applicationId);
  view.setUint32(92, 7); // « version-valid-for » : concorde, donc le nombre de pages est fiable
  return bytes;
}

const code = (bytes: Uint8Array) => {
  try {
    checkHeader(bytes);
    return 'ok';
  } catch (error) {
    return error instanceof BackupError ? error.code : 'autre';
  }
};

describe('checkHeader', () => {
  it('accepte un en-tête Sovmilo complet', () => expect(code(header())).toBe('ok'));
  it('refuse un fichier vide', () => expect(code(new Uint8Array(0))).toBe('empty'));
  it('refuse un fichier trop court ou qui n\'est pas SQLite', () => {
    expect(code(new Uint8Array(40))).toBe('notSqlite');
    expect(code(new Uint8Array(4096).fill(65))).toBe('notSqlite');
  });
  it('refuse une base SQLite qui n\'est pas Sovmilo', () => expect(code(header({ applicationId: 0 }))).toBe('notSovmilo'));
  it('détecte un fichier tronqué', () => expect(code(header({ pages: 10, length: 5 * 4096 }))).toBe('truncated'));
  it('refuse un fichier excessivement volumineux avant de le lire', () => expect(code(new Uint8Array(MAX_BACKUP_BYTES + 1))).toBe('tooLarge'));
});

describe('decideSchema', () => {
  it('applique la politique de compatibilité', () => {
    expect(decideSchema(5, 5)).toBe('current');
    expect(decideSchema(3, 5)).toBe('migrate');
    expect(decideSchema(1, 5)).toBe('migrate');
    expect(decideSchema(6, 5)).toBe('future');
    expect(decideSchema(0, 5)).toBe('unknown');
    expect(decideSchema(-1, 5)).toBe('unknown');
    expect(decideSchema(2.5, 5)).toBe('unknown');
  });
});

describe('backupFileName', () => {
  it('est lisible et trié par date', () => {
    expect(backupFileName(new Date(2026, 10, 2, 9, 5))).toBe('sovmilo-backup-2026-11-02-0905.db');
    expect(backupFileName(new Date(2026, 11, 31, 23, 59))).toBe('sovmilo-backup-2026-12-31-2359.db');
  });
});
