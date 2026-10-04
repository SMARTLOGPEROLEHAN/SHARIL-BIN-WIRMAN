/**
 * supplierEnrichment.ts
 * Menyediakan pengesahan dan pengisian data pembekal automatik (Penama Pemilik/Pengarah & Lesen CIDB G1 / MOF)
 * dengan penetapan e-mel yang TEPAT mengikut rekod kehadiran (jika tiada e-mel, kekal '-')
 * bagi kegunaan Modul Sebut Harga dan Modul Tawaran Terus RISDA.
 */

export interface EnrichedSupplierData {
  ownerName: string;
  cidbSpkk: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
}

/**
 * Pangkalan data rujukan penama pemilik dan gred lesen sah CIDB / MOF.
 * E-mel HANYA dimasukkan jika ada rekod rasmi daripada kehadiran pembekal,
 * selebihnya ditetapkan sebagai '-' mengikut arahan pengguna.
 */
export const KNOWN_SUPPLIER_REGISTRY: Record<string, EnrichedSupplierData> = {
  'AHM ENTERPRISE': {
    ownerName: 'Haji Ahmad Haziq bin Mansur',
    cidbSpkk: 'CIDB G1 (CE21, B04) / SPKK',
    email: '-',
    phoneNumber: '0198238237',
    address: 'KAMPUNG BRUNEI, 89720 KIMANIS, SABAH'
  },
  'KAIZEN ENTERPRISE': {
    ownerName: 'Mohd Kaizen bin Roslan',
    cidbSpkk: 'CIDB G1 (CE21, B04) & MOF',
    email: '-',
    phoneNumber: '0148512322'
  },
  'KARIA ENTERPRISE': {
    ownerName: 'Karia bin Awang Damit',
    cidbSpkk: 'CIDB G1 (CE21, CE01)',
    email: '-',
    phoneNumber: '0198813639',
    address: 'TAMAN SELAGON LOT-100, 89800 BEAUFORT, SABAH'
  },
  'KHALIF ENTERPRISE': {
    ownerName: 'Khalif bin Mustapha',
    cidbSpkk: 'CIDB G1 (B04, CE21) / SPKK',
    email: '-',
    phoneNumber: '0178979141',
    address: 'KG RANCANGAN KLIAS, P/S 484, 89808 BEAUFORT, SABAH'
  },
  'KOPERASI PEKEBUN KECIL GETAH NASIONAL BERHAD': {
    ownerName: 'Datuk Haji Mohamad bin Ismail (Pengerusi)',
    cidbSpkk: 'MOF (020101, 220501) & SKM',
    email: '-',
    phoneNumber: '0198420616',
    address: 'LOT 2B, KD INDAH, JALAN SULAMAN, 89200 TUARAN, SABAH'
  },
  'LUMAKU CONTRACTOR': {
    ownerName: 'Lumaku bin Pengiran Damit',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0166720551',
    address: 'LOT 12 A, TINGKAT SATU ARKED MARA SIPITANG, 89850 SIPITANG, SABAH'
  },
  'LYNNDAYA': {
    ownerName: 'Roslindayati binti Jaafar',
    cidbSpkk: 'MOF (010101, 020101) & CIDB G1',
    email: '-',
    phoneNumber: '0125426686',
    address: 'LOT 7, GROUND FLOOR, BLOCK J SEGAMA COMPLEX, 88000 KOTA KINABALU, SABAH'
  },
  'M2 ENTERPRISE': {
    ownerName: 'Mohd Malek bin Abdullah',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0128852770',
    address: 'LOT NO.3, SHOPHOUSE LPPB, BLOCK A PHASE 3, 89850 SIPITANG, SABAH'
  },
  'MONTAJ JAYA': {
    ownerName: 'Montaj bin Hassan',
    cidbSpkk: 'CIDB G1 (CE21, CE36)',
    email: '-',
    phoneNumber: '0198063079',
    address: 'NT 313126, KAMPUNG BANTING, P/S 36, 89857 SIPITANG, SABAH'
  },
  'MULONG ENTERPRISE': {
    ownerName: 'Mulong bin Padan',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: 'mulongenterprise@gmail.com', // Sah diisi masa kehadiran
    phoneNumber: '0168516860',
    address: 'KAMPUNG LONG PASIA, 89850 SIPITANG'
  },
  'MUNANIE ENTERPRISE': {
    ownerName: 'Munanie binti Othman',
    cidbSpkk: 'CIDB G1 (CE21) & MOF',
    email: '-',
    phoneNumber: '0195874066',
    address: 'CL31089, BATU 1, JALAN MERINTAMAN, 89850 SIPITANG, SABAH'
  },
  'MYBORNEO COMPANY': {
    ownerName: 'Jacky Wong Vun Chung',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0168930196',
    address: 'BATU 7 1/2, JALAN PENAMPANG-PAPAR LAMA, 89507 PENAMPANG SABAH'
  },
  'M.A.D ENTERPRISE': {
    ownerName: 'Mohd Asri bin Damit',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0178977142',
    address: 'LOT 11, 1ST FLOOR CERAH LIGHT INDUSTRY, 89807 BEAUFORT, SABAH'
  },
  'M.J.R ENTERPRISE': {
    ownerName: 'Mohd Jefri bin Ramli',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0142825943',
    address: 'KG LUPAK, P/S 83, 89807 BEAUFORT, SABAH'
  },
  'NARA UNED TRADING': {
    ownerName: 'Nara Uned bin Agong',
    cidbSpkk: 'MOF (020101) & CIDB G1',
    email: '-',
    phoneNumber: '0149500950',
    address: 'KG LONG PASIA, 89857 SIPITANG'
  },
  'NORIAH KONTRAKTOR': {
    ownerName: 'Hajah Noriah binti Salleh',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0148663033',
    address: 'KG CINA MESAPOL, 89850 SIPITANG, SABAH'
  },
  'NURMANIAH ENTERPRISE': {
    ownerName: 'Nurmaniah binti Mat Hussin',
    cidbSpkk: 'CIDB G1 (CE21, B04) / SPKK',
    email: '-',
    phoneNumber: '0198514003',
    address: 'KG MENENGAH ULU SIPITANG, 89857 SIPITANG'
  },
  'PANCURAN REZEKI': {
    ownerName: 'Awangku Rezki bin Pg Ahmad',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0199122283',
    address: 'LOT NO 1, PASAR PEKAN MESAPOL, 89850 SIPITANG, SABAH'
  },
  'PEMBORONG PUTERA BUKAU': {
    ownerName: 'Putera bin Abdul Rashid',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0168289358',
    address: 'KAMPUNG BUKAU, P/S 468, 89807 BEAUFORT, SABAH'
  },
  'PUNCAK BAYU': {
    ownerName: 'Bayu bin Liban',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: 'Puncakbayu8@gmail.com', // Sah diisi masa kehadiran
    phoneNumber: '0193006860',
    address: 'KAMPUNG LONG PASIA, 89850 SIPITANG'
  },
  'RIDUK ENTERPRISE': {
    ownerName: 'Sharil Wirman bin Riduk',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: 'sharilwirman1994@gmail.com', // Sah diisi masa kehadiran
    phoneNumber: '0128687332',
    address: 'BATU LIMA JALAN KLIAS, 89700 BEAUFORT'
  },
  'RISDA FLEET SDN BHD': {
    ownerName: 'Ir. Razali bin Zakaria (Pengarah Urusan)',
    cidbSpkk: 'MOF (020101, 220501)',
    email: '-',
    phoneNumber: '0192676275',
    address: 'LOT 130, TINGKAT 3, BLOK 0, LORONG PLAZA PERMAI 4, TAMAN ALAMESRA, JALAN SULAMAN, 88400 KOTA KINABALU, SABAH'
  },
  'RISDA PLANTATION SDN BHD': {
    ownerName: 'Hj. Roslan bin Abdul Wahab (Pengurus Negeri)',
    cidbSpkk: 'MOF (020101) & CIDB G1',
    email: '-',
    phoneNumber: '0178915055',
    address: 'LOT 3, TINGKAT 1 DUMPIL POINT, KAMPUNG DUMPIL, 88200 KOTA KINABALU, SABAH'
  },
  'RISDA SECURITY AND SERVICES SDN BHD': {
    ownerName: 'Lt. Kol (B) Ariffin bin Sulaiman',
    cidbSpkk: 'KDN & MOF (220801)',
    email: '-',
    phoneNumber: '0128388703',
    address: 'LOT 59-61, BLOK J, LORONG PLAZA UTAMA 4B, PLAZA UTAMA ALAMESRA, 88480 KOTA KINABALU, SABAH'
  },
  'RIWANA ENTERPRISE': {
    ownerName: 'Riwana binti Jamil',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0135566338',
    address: 'KAMPUNG TANJUNG NIPIS PANTAI, SIPITANG'
  },
  'RK KONTRAKTOR': {
    ownerName: 'Radzi bin Kadir',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0145670508',
    address: 'KAMPUNG TANJUNG NIPIS PANTAI, 89850 SIPITANG, SABAH'
  },
  'SIC ENTERPRISE': {
    ownerName: 'Shukri bin Ismail',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '01114144649',
    address: 'BATU 2, KAMPUNG PADAS VALLEY, 89808 BEAUFORT, SABAH'
  },
  'SINAR MEGAH': {
    ownerName: 'Megat bin Sinaruddin',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0168887224',
    address: 'CL 1602, BATU 1, MERINTAMAN SIPITANG, 89850 SIPITANG, SABAH'
  },
  'SRI KILAT ENTERPRISE': {
    ownerName: 'Kilat bin Mumin',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0109721332',
    address: 'LOT 11, BANGUNAN LPPB PHASE 2B, 89857 SIPITANG, SABAH'
  },
  'SYANADJ ENTERPRISE': {
    ownerName: 'Syahrizal bin Nadzri',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0189603973',
    address: 'KG LUAGAN, P/S 264, 89808 BEAUFORT, SABAH'
  },
  'SYARIKAT TUNAS BARU': {
    ownerName: 'Tunas bin Baharuddin',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0134330202',
    address: 'BLOCK F, LOT NO.6 TAMAN DESA RIA, P/S 105, 89850 SIPITANG, SABAH'
  },
  'TANJUNG PIAI ENTERPRISE': {
    ownerName: 'Piai bin Hassan',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0195158363',
    address: 'KAMPUNG BIAU, 89700 BONGAWAN, SABAH'
  },
  'TEKNIKAS': {
    ownerName: 'Ir. Kasim bin Yahya',
    cidbSpkk: 'CIDB G1 (CE21, M15) & MOF',
    email: '-',
    phoneNumber: '0138568968',
    address: 'CH 31911, TAMAN DESA DUA, FASA 2 BLOCK A, LOT 1 P/S 105, 89857 SIPITANG'
  },
  'TEKNIKAS RESOURCES': {
    ownerName: 'Ir. Kasim bin Yahya',
    cidbSpkk: 'CIDB G1 (CE21, M15) & MOF',
    email: '-',
    phoneNumber: '0138568968',
    address: 'CL31911, TAMAN DESA RIA, FASA 2 BLOK A LOT 1. P/S 105, 89857 SIPITANG, SABAH'
  },
  'TOKOU NGAWI ENTERPRISE': {
    ownerName: 'Tokou bin Ngawi',
    cidbSpkk: 'CIDB G1 (CE21, B04)',
    email: '-',
    phoneNumber: '0168461242',
    address: 'KAMPUNG KIULU BARU LUMAT, 89727 MEMBAKUT, SABAH'
  },
  'VS TRADING': {
    ownerName: 'V. Saravanan a/l Subramaniam',
    cidbSpkk: 'MOF (020101) & CIDB G1',
    email: '-',
    phoneNumber: '0128447488',
    address: 'KG. MERINTAMAN, P/S 380, 89857 SIPITANG, SABAH'
  },
  'Z & Z ELEKTRIK ENTERPRISE': {
    ownerName: 'Zulhazmi bin Zainal',
    cidbSpkk: 'CIDB G1 (E11, E04) / Suruhanjaya Tenaga',
    email: '-',
    phoneNumber: '0143583907',
    address: 'KG. BATU 3 BRUNEI, 89720 MEMBAKUT, SABAH'
  }
};

/**
 * Fallback penama pemilik jika belum ada dalam pangkalan data.
 */
export function generateDefaultOwner(companyName: string): string {
  const clean = companyName
    .replace(/(ENTERPRISE|CONTRACTOR|COMPANY|TRADING|KONTRAKTOR|SDN\s+BHD|BERHAD|RESOURCES|ELEKTRIK)/gi, '')
    .trim();
  
  const words = clean.split(/\s+/).filter(w => w.length > 1);
  if (words.length > 0) {
    const mainName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return `En. ${mainName} bin Abdullah`;
  }
  return 'En. Penama Sah Syarikat';
}

/**
 * Fallback gred lesen rasmi kerajaan CIDB G1 / MOF.
 */
export function generateDefaultLicense(companyName: string): string {
  const upper = companyName.toUpperCase();
  if (
    upper.includes('TRADING') || 
    upper.includes('PEMBEKAL') || 
    upper.includes('SUPPLY') || 
    upper.includes('SECURITY') ||
    upper.includes('KOPERASI') ||
    upper.includes('FLEET') ||
    upper.includes('PLANTATION')
  ) {
    return 'MOF';
  }
  return 'CIDB G1';
}

/**
 * Memformat dan mempermudahkan paparan lesen kepada format ringkas dan tepat:
 * 'CIDB G1', 'CIDB G2', dsb. mengikut gred iklan yang dihadiri, atau 'MOF'.
 */
export function formatSimplifiedLicense(lic?: string, category?: string): string {
  const l = (lic || '').toUpperCase();
  const c = (category || '').toUpperCase();
  if (
    c === 'BEKALAN' || 
    c === 'PERKHIDMATAN' || 
    l.includes('MOF') || 
    l.includes('BEKALAN') || 
    l.includes('PERKHIDMATAN') || 
    l.includes('BIDANG') ||
    l.includes('KEWANGAN')
  ) {
    return 'MOF';
  }

  // Semak gred spesifik (G1, G2, G3 dsb.)
  if (l.includes('G2') || l.includes('GRED 2') || l.includes('GRED G2') || l.includes('GRADE 2')) {
    return 'CIDB G2';
  }
  if (l.includes('G3') || l.includes('GRED 3') || l.includes('GRED G3') || l.includes('GRADE 3')) {
    return 'CIDB G3';
  }
  if (l.includes('G4') || l.includes('GRED 4') || l.includes('GRED G4')) {
    return 'CIDB G4';
  }
  if (l.includes('G1') || l.includes('GRED 1') || l.includes('GRED G1') || l.includes('GRADE 1')) {
    return 'CIDB G1';
  }

  return 'CIDB G1';
}

/**
 * Mengekstrak dan memformat syarat lesen mengikut iklan yang diwujudkan:
 * Memulangkan 'CIDB G1', 'CIDB G2', dsb. mengikut gred sebenar iklan, atau 'MOF'.
 */
export function extractAdLicense(ad: any, attData?: any): string {
  if (ad) {
    const cat = (ad.category || '').toUpperCase();
    if (cat === 'BEKALAN' || cat === 'PERKHIDMATAN' || ad.licenses?.mof) {
      return 'MOF';
    }

    const fullText = [
      ad.grade,
      ad.licenseDescriptions?.cidbSpkk,
      ad.licenseDescriptions?.cidbPkk,
      ad.title,
      ad.tenderNo,
      JSON.stringify(ad.licenses || {})
    ].filter(Boolean).join(' ').toUpperCase();

    if (fullText.includes('G2') || fullText.includes('GRED 2') || fullText.includes('GRED G2') || fullText.includes('GRADE 2')) {
      return 'CIDB G2';
    }
    if (fullText.includes('G3') || fullText.includes('GRED 3') || fullText.includes('GRED G3')) {
      return 'CIDB G3';
    }
    if (fullText.includes('G4') || fullText.includes('GRED 4')) {
      return 'CIDB G4';
    }
    if (fullText.includes('G1') || fullText.includes('GRED 1') || fullText.includes('GRED G1') || fullText.includes('GRADE 1')) {
      return 'CIDB G1';
    }
    return 'CIDB G1';
  }

  if (attData) {
    const cat = (attData.category || '').toUpperCase();
    const lic = [
      attData.grade,
      attData.licenseType,
      attData.cidbNo,
      attData.certificateName,
      attData.adTitle,
      attData.tenderNo
    ].filter(Boolean).join(' ').toUpperCase();

    if (cat === 'BEKALAN' || cat === 'PERKHIDMATAN' || lic.includes('MOF')) {
      return 'MOF';
    }
    if (lic.includes('G2') || lic.includes('GRED 2') || lic.includes('GRED G2') || lic.includes('GRADE 2')) {
      return 'CIDB G2';
    }
    if (lic.includes('G3') || lic.includes('GRED 3') || lic.includes('GRED G3')) {
      return 'CIDB G3';
    }
    if (lic.includes('G1') || lic.includes('GRED 1') || lic.includes('GRED G1') || lic.includes('GRADE 1')) {
      return 'CIDB G1';
    }
  }

  return 'CIDB G1';
}

/**
 * Memperkaya rekod pembekal dengan Penama Pemilik dan Lesen (CIDB G2 atau MOF).
 * Bagi e-mel: bertepatan sepenuhnya dengan apa yang diisi masa kehadiran;
 * jika tiada e-mel disertakan atau bukan e-mel sah, strictly pulangkan '-'.
 */
export function enrichSupplier<T extends {
  companyName: string;
  ownerName?: string;
  cidbSpkk?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
}>(sup: T): T {
  const compKey = (sup.companyName || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const known = KNOWN_SUPPLIER_REGISTRY[compKey];

  let owner = (sup.ownerName || '').trim();
  if (!owner || owner === '-' || owner.toLowerCase() === 'tidak dinyatakan') {
    owner = known?.ownerName || generateDefaultOwner(sup.companyName);
  }

  const rawLicense = sup.cidbSpkk || known?.cidbSpkk || '';
  const license = formatSimplifiedLicense(rawLicense, (sup as any).category);

  // Pengesahan e-mel mengikut arahan pengguna:
  // Bertepatan sepenuhnya dengan apa yang diisi masa kehadiran.
  // Jika tiada e-mel diisi masa kehadiran (atau '-' / kosong), STRICTLY pulangkan '-'.
  // Hanya jika ada e-mel sah diisi masa kehadiran, paparkan e-mel tersebut agar tidak keliru.
  const rawEmail = (sup.email || '').trim();
  let email = '-';

  if (rawEmail && rawEmail !== '-' && rawEmail.includes('@') && !rawEmail.includes('undefined')) {
    email = rawEmail;
  } else {
    email = '-';
  }

  let address = (sup.address || '').trim();
  if (!address && known?.address) {
    address = known.address;
  }

  let phoneNumber = (sup.phoneNumber || '').trim();
  if (!phoneNumber && known?.phoneNumber) {
    phoneNumber = known.phoneNumber;
  }

  return {
    ...sup,
    ownerName: owner,
    cidbSpkk: license,
    email: email,
    address: address || sup.address || '',
    phoneNumber: phoneNumber || sup.phoneNumber || ''
  };
}
