// src/lib/csvTemplate.ts

export interface BulkCertificateEntry {
  studentWallet: string;
  studentName: string;
  program: string;
  graduationDate: string;
  pdfFilename: string;
  documentHash?: string;
  pdfFile?: File;
  validationErrors: string[];
}

export function generateCSVTemplate(): string {
  const headers = ['student_wallet', 'student_name', 'program', 'graduation_date', 'pdf_filename'];
  const exampleRows = [
    ['0x1234567890123456789012345678901234567890', 'John Doe', 'Computer Science', '2025-12-15', 'john_doe_diploma.pdf'],
    ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 'Jane Smith', 'Mathematics', '2025-12-15', 'jane_smith_diploma.pdf'],
  ];
  
  const csvContent = [
    headers.join(','),
    ...exampleRows.map(row => row.join(','))
  ].join('\n');
  
  return csvContent;
}

export function downloadCSVTemplate() {
  const csvContent = generateCSVTemplate();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', 'certificate_bulk_upload_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseCSV(csvText: string): BulkCertificateEntry[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const requiredHeaders = ['student_wallet', 'student_name', 'program', 'graduation_date', 'pdf_filename'];
  
  // Validate headers
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required CSV headers: ${missingHeaders.join(', ')}`);
  }

  // Get column indices
  const indices = {
    studentWallet: headers.indexOf('student_wallet'),
    studentName: headers.indexOf('student_name'),
    program: headers.indexOf('program'),
    graduationDate: headers.indexOf('graduation_date'),
    pdfFilename: headers.indexOf('pdf_filename'),
  };

  // Parse rows
  const entries: BulkCertificateEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = line.split(',').map(v => v.trim());
    
    const entry: BulkCertificateEntry = {
      studentWallet: values[indices.studentWallet] || '',
      studentName: values[indices.studentName] || '',
      program: values[indices.program] || '',
      graduationDate: values[indices.graduationDate] || '',
      pdfFilename: values[indices.pdfFilename] || '',
      validationErrors: [],
    };

    // Validate entry
    if (!entry.studentWallet || !entry.studentWallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      entry.validationErrors.push('Invalid wallet address format');
    }
    if (!entry.studentName) {
      entry.validationErrors.push('Student name is required');
    }
    if (!entry.program) {
      entry.validationErrors.push('Program is required');
    }
    if (!entry.graduationDate || !entry.graduationDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      entry.validationErrors.push('Invalid date format (use YYYY-MM-DD)');
    }
    if (!entry.pdfFilename || !entry.pdfFilename.endsWith('.pdf')) {
      entry.validationErrors.push('PDF filename must end with .pdf');
    }

    entries.push(entry);
  }

  return entries;
}

export function matchPDFsToEntries(
  entries: BulkCertificateEntry[],
  pdfFiles: File[]
): BulkCertificateEntry[] {
  return entries.map(entry => {
    const matchedFile = pdfFiles.find(
      file => file.name.toLowerCase() === entry.pdfFilename.toLowerCase()
    );
    
    if (!matchedFile && entry.validationErrors.length === 0) {
      entry.validationErrors.push(`PDF file "${entry.pdfFilename}" not found`);
    }
    
    return {
      ...entry,
      pdfFile: matchedFile,
    };
  });
}
