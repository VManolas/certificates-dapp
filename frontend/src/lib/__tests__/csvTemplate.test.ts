// src/lib/__tests__/csvTemplate.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadCSVTemplate,
  generateCSVTemplate,
  matchPDFsToEntries,
  parseCSV,
  type BulkCertificateEntry,
} from '@/lib/csvTemplate';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const VALID_WALLET_2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function buildCSV(rows: string[]): string {
  const header = 'student_wallet,student_name,program,graduation_year,pdf_filename';
  return [header, ...rows].join('\n');
}

function validRow(overrides: Partial<{
  wallet: string; name: string; program: string; year: string; pdf: string;
}> = {}): string {
  return [
    overrides.wallet  ?? VALID_WALLET,
    overrides.name    ?? 'John Doe',
    overrides.program ?? 'BSc Computer Science',
    overrides.year    ?? '2024',
    overrides.pdf     ?? 'john.pdf',
  ].join(',');
}

describe('csvTemplate', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── generateCSVTemplate ─────────────────────────────────────────────────

  describe('generateCSVTemplate', () => {
    it('includes the five required column headers', () => {
      const csv = generateCSVTemplate();
      const firstLine = csv.split('\n')[0];
      expect(firstLine).toContain('student_wallet');
      expect(firstLine).toContain('student_name');
      expect(firstLine).toContain('program');
      expect(firstLine).toContain('graduation_year');
      expect(firstLine).toContain('pdf_filename');
    });

    it('includes at least one example data row', () => {
      const lines = generateCSVTemplate().split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });

    it('example rows contain wallet addresses starting with 0x', () => {
      const lines = generateCSVTemplate().split('\n').slice(1);
      for (const line of lines) {
        if (line.trim()) {
          expect(line.startsWith('0x')).toBe(true);
        }
      }
    });
  });

  // ─── downloadCSVTemplate ─────────────────────────────────────────────────

  describe('downloadCSVTemplate', () => {
    it('creates a blob URL and triggers a click', () => {
      downloadCSVTemplate();
      expect(global.URL.createObjectURL).toHaveBeenCalledOnce();
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('sets the download filename to end in .csv', () => {
      const setAttr = vi.spyOn(HTMLAnchorElement.prototype, 'setAttribute');
      downloadCSVTemplate();
      const downloadCall = setAttr.mock.calls.find((c) => c[0] === 'download');
      expect(downloadCall?.[1]).toMatch(/\.csv$/);
    });
  });

  // ─── parseCSV ────────────────────────────────────────────────────────────

  describe('parseCSV', () => {
    it('throws when the input has fewer than 2 lines', () => {
      expect(() => parseCSV('student_wallet')).toThrow(/empty|no data/i);
    });

    it('throws when required headers are missing', () => {
      expect(() => parseCSV('name,wallet\nJohn,0x1234')).toThrow(/Missing required CSV headers/i);
    });

    it('throws listing which headers are missing', () => {
      try {
        parseCSV('student_wallet,student_name\n0x1234,John');
      } catch (e) {
        expect((e as Error).message).toContain('program');
        expect((e as Error).message).toContain('graduation_year');
        expect((e as Error).message).toContain('pdf_filename');
      }
    });

    it('parses a fully valid row without validation errors', () => {
      const csv = buildCSV([validRow()]);
      const result = parseCSV(csv);
      expect(result).toHaveLength(1);
      expect(result[0].validationErrors).toHaveLength(0);
      expect(result[0].studentWallet).toBe(VALID_WALLET);
      expect(result[0].studentName).toBe('John Doe');
      expect(result[0].program).toBe('BSc Computer Science');
      expect(result[0].graduationYear).toBe(2024);
      expect(result[0].pdfFilename).toBe('john.pdf');
    });

    it('skips empty lines in the CSV body', () => {
      const csv = buildCSV([validRow(), '', validRow({ wallet: VALID_WALLET_2 })]);
      expect(parseCSV(csv)).toHaveLength(2);
    });

    it('parses multiple rows correctly', () => {
      const csv = buildCSV([
        validRow({ wallet: VALID_WALLET }),
        validRow({ wallet: VALID_WALLET_2, name: 'Jane Smith', pdf: 'jane.pdf' }),
      ]);
      const result = parseCSV(csv);
      expect(result).toHaveLength(2);
      expect(result[1].studentName).toBe('Jane Smith');
    });

    it('adds a validation error for an invalid wallet address', () => {
      const csv = buildCSV([validRow({ wallet: 'not-an-address' })]);
      const result = parseCSV(csv);
      expect(result[0].validationErrors).toContain('Invalid wallet address format');
    });

    it('adds a validation error when student name is empty', () => {
      const csv = buildCSV([validRow({ name: '' })]);
      const result = parseCSV(csv);
      expect(result[0].validationErrors).toContain('Student name is required');
    });

    it('adds a validation error when program is empty', () => {
      const csv = buildCSV([validRow({ program: '' })]);
      const result = parseCSV(csv);
      expect(result[0].validationErrors).toContain('Program is required');
    });

    it('adds a validation error for a non-numeric graduation year', () => {
      const csv = buildCSV([validRow({ year: 'not-a-year' })]);
      const result = parseCSV(csv);
      expect(result[0].validationErrors.some((e) => /graduation year/i.test(e))).toBe(true);
    });

    it('adds a validation error for graduation year below 1900', () => {
      const csv = buildCSV([validRow({ year: '1800' })]);
      const result = parseCSV(csv);
      expect(result[0].validationErrors.some((e) => /1900.*2100/i.test(e))).toBe(true);
    });

    it('adds a validation error for graduation year above 2100', () => {
      const csv = buildCSV([validRow({ year: '2200' })]);
      const result = parseCSV(csv);
      expect(result[0].validationErrors.some((e) => /1900.*2100/i.test(e))).toBe(true);
    });

    it('accepts boundary graduation years 1900 and 2100', () => {
      const csv1900 = buildCSV([validRow({ year: '1900' })]);
      const csv2100 = buildCSV([validRow({ year: '2100' })]);
      expect(parseCSV(csv1900)[0].validationErrors).toHaveLength(0);
      expect(parseCSV(csv2100)[0].validationErrors).toHaveLength(0);
    });

    it('adds a validation error when pdf_filename does not end with .pdf', () => {
      const csv = buildCSV([validRow({ pdf: 'document.docx' })]);
      const result = parseCSV(csv);
      expect(result[0].validationErrors.some((e) => /\.pdf/i.test(e))).toBe(true);
    });

    it('a row can accumulate multiple validation errors', () => {
      const csv = buildCSV([validRow({ wallet: 'bad', name: '', year: 'abc', pdf: 'file.txt' })]);
      const result = parseCSV(csv);
      expect(result[0].validationErrors.length).toBeGreaterThan(2);
    });
  });

  // ─── matchPDFsToEntries ───────────────────────────────────────────────────

  describe('matchPDFsToEntries', () => {
    function makeEntry(overrides?: Partial<BulkCertificateEntry>): BulkCertificateEntry {
      return {
        studentWallet: VALID_WALLET,
        studentName: 'John',
        program: 'BSc',
        graduationYear: 2024,
        pdfFilename: 'john.pdf',
        validationErrors: [],
        ...overrides,
      };
    }

    function makePDF(name: string): File {
      return new File(['%PDF-1'], name, { type: 'application/pdf' });
    }

    it('matches a PDF file to an entry by filename', () => {
      const entry = makeEntry();
      const file = makePDF('john.pdf');
      const result = matchPDFsToEntries([entry], [file]);
      expect(result[0].pdfFile).toBe(file);
    });

    it('matches case-insensitively', () => {
      const entry = makeEntry({ pdfFilename: 'John.PDF' });
      const file = makePDF('john.pdf');
      const result = matchPDFsToEntries([entry], [file]);
      expect(result[0].pdfFile).toBe(file);
    });

    it('adds a validation error when the PDF file is not found and entry had no prior errors', () => {
      const entry = makeEntry({ pdfFilename: 'missing.pdf' });
      const result = matchPDFsToEntries([entry], []);
      expect(result[0].validationErrors).toContain('PDF file "missing.pdf" not found');
    });

    it('does NOT add a PDF-not-found error when the entry already has validation errors', () => {
      const entry = makeEntry({
        pdfFilename: 'missing.pdf',
        validationErrors: ['Invalid wallet address format'],
      });
      const result = matchPDFsToEntries([entry], []);
      expect(result[0].validationErrors).toHaveLength(1);
      expect(result[0].validationErrors[0]).toBe('Invalid wallet address format');
    });

    it('preserves unmatched entries without modifying other fields', () => {
      const entry = makeEntry({ pdfFilename: 'other.pdf' });
      const result = matchPDFsToEntries([entry], [makePDF('different.pdf')]);
      expect(result[0].studentWallet).toBe(VALID_WALLET);
    });

    it('handles multiple entries and multiple files correctly', () => {
      const entries = [
        makeEntry({ pdfFilename: 'a.pdf' }),
        makeEntry({ pdfFilename: 'b.pdf', studentWallet: VALID_WALLET_2 }),
      ];
      const files = [makePDF('b.pdf'), makePDF('a.pdf')];
      const result = matchPDFsToEntries(entries, files);
      expect(result[0].pdfFile?.name).toBe('a.pdf');
      expect(result[1].pdfFile?.name).toBe('b.pdf');
    });
  });
});
