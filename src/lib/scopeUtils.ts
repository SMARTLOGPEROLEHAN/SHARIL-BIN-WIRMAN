export interface UserAuthScope {
  role: string | null;
  state: string | null;
  district: string | null;
  office: string | null;
}

/**
 * Checks if a given item (advertisement, attendance, invitation, report, staff user, etc.)
 * is within the logged-in user's role-based access scope.
 * 
 * Rules:
 * - PENTADBIR SISTEM / ADMIN / PEMBUAT SISTEM (pentadbir | admin): Akses penuh ke seluruh sistem tanpa had capaian (Global/National Superadmin) — Nampak segalanya yang kakitangan di setiap pejabat buat.
 * - PENGINPUT / PELULUS: Hanya melihat maklumat/rekod di DAERAH/PEJABAT tempat bertugas sahaja.
 * - Pelawat: Akses paparan awam.
 */
export function isWithinUserScope(
  item: { state?: string; district?: string; office?: string; [key: string]: any },
  userScope: UserAuthScope
): boolean {
  const { role, state: userState, district: userDistrict, office: userOffice } = userScope;

  // If visitor or role not set, allow public view
  if (!role || role === 'pelawat') return true;

  // PENTADBIR SISTEM / ADMIN / PEMBUAT SISTEM -> UNRESTRICTED GLOBAL ACCESS (Nampak segalanya di semua pejabat)
  if (role === 'pentadbir' || role === 'admin') {
    return true;
  }

  const uState = (userState || '').trim().toUpperCase();
  const uDistrict = (userDistrict || '').trim().toUpperCase();
  const uOffice = (userOffice || '').trim().toUpperCase();

  const iState = (item.state || '').trim().toUpperCase();
  const iDistrict = (item.district || '').trim().toUpperCase();
  const iOffice = (item.office || '').trim().toUpperCase();

  // PENGINPUT / PELULUS (Kakitangan di setiap pejabat) -> District / Office level scope (Hanya nampak rekod pejabat/daerah sendiri)
  if (role === 'penginput' || role === 'pelulus') {
    // If staff has no district or office assigned yet, permit all as fallback or until assigned
    if (!uDistrict && !uOffice) return true;

    // Normalize strings to strip common prefixes for robust matching
    const cleanUOffice = uOffice.replace(/PEJABAT RISDA DAERAH|PRD|PEJABAT RISDA NEGERI|PRN/gi, '').trim();
    const cleanIOffice = iOffice.replace(/PEJABAT RISDA DAERAH|PRD|PEJABAT RISDA NEGERI|PRN/gi, '').trim();

    // Direct district match
    if (uDistrict && iDistrict && uDistrict === iDistrict) return true;

    // Direct office match
    if (uOffice && iOffice && uOffice === iOffice) return true;

    // Partial/substring match between office & district strings
    // e.g. userOffice = "PEJABAT RISDA DAERAH BEAUFORT", item.district = "BEAUFORT"
    if (uOffice && iDistrict && (uOffice.includes(iDistrict) || (cleanIOffice && uOffice.includes(cleanIOffice)))) return true;
    if (uDistrict && iOffice && (iOffice.includes(uDistrict) || (cleanUOffice && iOffice.includes(cleanUOffice)))) return true;
    if (cleanUOffice && cleanIOffice && (cleanUOffice === cleanIOffice || cleanUOffice.includes(cleanIOffice) || cleanIOffice.includes(cleanUOffice))) return true;

    // If item has no location info at all, permit
    if (!iState && !iDistrict && !iOffice) return true;

    return false;
  }

  return true;
}

/**
 * Filter an array of items by the user's role scope.
 */
export function filterByScope<T extends { state?: string; district?: string; office?: string }>(
  items: T[],
  userScope: UserAuthScope
): T[] {
  return items.filter(item => isWithinUserScope(item, userScope));
}

/**
 * Checks if an advertisement / sebut harga has a finalized official decision (winner selected or sebutharga semula / completed / cancelled).
 * Returns true if an official decision has been finalized.
 */
export function isAdWinnerFinalized(ad: any): boolean {
  if (!ad) return false;

  if (
    ad.status === 'SELESAI (KEPUTUSAN)' ||
    ad.status === 'BATAL' ||
    ad.statusPelaksanaan === 'SEBUTHARGA SEMULA' ||
    ad.statusPelaksanaan === 'TAMAT'
  ) {
    return true;
  }

  if (ad.winner) {
    const company = (ad.winner.companyName || ad.winner.companyId || '').trim();
    if (company !== '' || ad.winner.isReTender) {
      return true;
    }
  }

  if (ad.winnerName && ad.winnerName.trim() !== '' && ad.winnerName.trim() !== '-') {
    return true;
  }

  return false;
}

/**
 * Helper to parse any date string format used in the system:
 * - YYYY-MM-DD
 * - DD/MM/YYYY or DD-MM-YYYY
 * - Malay text format e.g. "12 Mac 2026", "28 Mei 2026", "19/03/2024"
 */
export function parseAnyDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim();
  if (!str || str === '-' || str === 'TIADA') return null;

  // Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // Check Malay text format e.g. "12 Mac 2026", "28 Mei 2026", "24 April 2024"
  const malayMonths: { [key: string]: number } = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mac: 2, march: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5, june: 5,
    jul: 6, julai: 6, july: 6,
    ogos: 7, ogs: 7, august: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9, october: 9,
    nov: 10, november: 10,
    dis: 11, desember: 11, december: 11
  };

  const malayMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (malayMatch) {
    const day = parseInt(malayMatch[1], 10);
    const monthKey = malayMatch[2].toLowerCase();
    const year = parseInt(malayMatch[3], 10);
    if (malayMonths[monthKey] !== undefined) {
      const d = new Date(year, malayMonths[monthKey], day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const standard = new Date(str);
  return isNaN(standard.getTime()) ? null : standard;
}

/**
 * Formats any date string to standard DD/MM/YYYY numeric format.
 * Converts Malay text month strings like "20 Mac 2024" or "02 April 2024" to "20/03/2024" and "02/04/2024".
 */
export function formatDateToDDMMYYYY(dateStr: string | undefined | null): string {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '' || dateStr === '-' || dateStr === 'TIADA') {
    return dateStr || '-';
  }
  const str = dateStr.trim();
  const parsed = parseAnyDate(str);
  if (!parsed) return str;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Auto-calculates completion duration (TEMPOH SIAP KERJA) in weeks from Tarikh Setuju Terima / Start Date to Tarikh Siap Kerja / End Date.
 * Example: 19/03/2024 to 24/04/2024 -> "5 MINGGU" (floor to 5 weeks even with 4 extra days).
 * Example: 12 Mac 2026 to 28 Mei 2026 -> "11 MINGGU".
 */
export function calculateTempohSiapKerja(startDateStr: string | undefined | null, endDateStr: string | undefined | null): string {
  const d1 = parseAnyDate(startDateStr);
  const d2 = parseAnyDate(endDateStr);

  if (!d1 || !d2) return '';

  const diffTime = d2.getTime() - d1.getTime();
  if (diffTime <= 0) return '';

  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
  const weeks = Math.floor(diffDays / 7);

  if (weeks >= 1) {
    return `${weeks} MINGGU`;
  } else if (diffDays > 0) {
    return `${diffDays} HARI`;
  }
  return '';
}

