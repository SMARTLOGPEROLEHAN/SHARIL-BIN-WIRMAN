import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { enrichSupplier, extractAdLicense } from './supplierEnrichment';

export interface SupplierRecord {
  id: string;
  companyName: string;
  ownerName: string;
  phoneNumber: string;
  email: string;
  address: string;
  cidbSpkk: string;
  state?: string;
  office?: string;
  source: 'attendance';
  sourceAdTitle?: string;
  sourceTenderNo?: string;
  projectsAttended?: Array<{
    adTitle: string;
    tenderNo: string;
    license: string;
  }>;
}

/**
 * Shared supplier directory hook
 * Pangkalan data pembekal berasaskan pendaftaran kehadiran taklimat tapak sahaja,
 * dengan kontrak/lesen dipaparkan mengikut iklan lesen yang diwujudkan.
 * Digunakan bagi kedua-dua Modul Sebut Harga dan Modul Tawaran Terus.
 */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch advertisements to extract license requirements
      const adsSnap = await getDocs(collection(db, 'ads'));
      const adsMap = new Map<string, any>();
      adsSnap.docs.forEach(docSnap => {
        const d: any = { id: docSnap.id, ...docSnap.data() };
        adsMap.set(docSnap.id, d);
        if (d.title) adsMap.set(d.title.toUpperCase().trim(), d);
        if (d.tenderNo) adsMap.set(d.tenderNo.toUpperCase().trim(), d);
      });

      // 2. Fetch exclusively from 'attendance' collection
      const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
      const mergedMap = new Map<string, SupplierRecord>();

      attendanceSnapshot.forEach(docSnap => {
        const d = docSnap.data();
        const comp = (d.companyName || d.contractorName || '').trim();
        if (!comp) return;

        const key = comp.toUpperCase();
        const rawEmail = (d.email || '').trim();
        const cleanEmail = rawEmail && rawEmail !== '-' && rawEmail.includes('@') ? rawEmail : '-';

        // Match advertisement to get the created license requirements
        const ad = adsMap.get(d.adId) || 
                   adsMap.get((d.adTitle || '').toUpperCase().trim()) || 
                   adsMap.get((d.tenderNo || '').toUpperCase().trim());
        const licenseFromAd = extractAdLicense(ad, d);

        const projectItem = {
          adTitle: d.adTitle || ad?.title || '',
          tenderNo: d.tenderNo || ad?.tenderNo || '',
          license: licenseFromAd
        };

        const existing = mergedMap.get(key);
        if (!existing) {
          mergedMap.set(key, {
            id: `attendance_${docSnap.id}`,
            companyName: comp,
            ownerName: d.ownerName || d.attendeeName || '-',
            phoneNumber: d.phoneNumber || d.phone || '-',
            email: cleanEmail,
            address: d.companyAddress || d.address || '-',
            cidbSpkk: licenseFromAd,
            state: d.state || '',
            office: d.office || '',
            source: 'attendance',
            sourceAdTitle: projectItem.adTitle,
            sourceTenderNo: projectItem.tenderNo,
            projectsAttended: [projectItem]
          });
        } else {
          // If already encountered this company from another attendance record:
          // Synchronize email: prefer valid email if one record had it
          if (cleanEmail !== '-' && existing.email === '-') {
            existing.email = cleanEmail;
          }
          // Fill owner name if existing was empty
          if ((!existing.ownerName || existing.ownerName === '-') && (d.ownerName || d.attendeeName)) {
            existing.ownerName = d.ownerName || d.attendeeName;
          }
          // Fill phone if missing
          if ((!existing.phoneNumber || existing.phoneNumber === '-') && (d.phoneNumber || d.phone)) {
            existing.phoneNumber = d.phoneNumber || d.phone;
          }
          // Fill address if missing
          if ((!existing.address || existing.address === '-') && (d.companyAddress || d.address)) {
            existing.address = d.companyAddress || d.address;
          }
          // Synchronize license: distinguish G1 vs G2 based on attended ad grade
          if (licenseFromAd && licenseFromAd.includes('G2')) {
            existing.cidbSpkk = 'CIDB G2';
          } else if (licenseFromAd && licenseFromAd.includes('G3')) {
            existing.cidbSpkk = 'CIDB G3';
          } else if (licenseFromAd && licenseFromAd.includes('G1') && !existing.cidbSpkk?.includes('G2')) {
            existing.cidbSpkk = 'CIDB G1';
          }
          // Append project attended
          if (!existing.projectsAttended) {
            existing.projectsAttended = [];
          }
          existing.projectsAttended.push(projectItem);
        }
      });

      const list = Array.from(mergedMap.values())
        .map(s => enrichSupplier(s))
        .sort((a, b) => a.companyName.localeCompare(b.companyName));

      setSuppliers(list);
    } catch (err: any) {
      console.error('Error fetching attendance suppliers:', err);
      setError(err?.message || 'Gagal memuatkan senarai pembekal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return { suppliers, loading, error, refetch: fetchSuppliers };
}

