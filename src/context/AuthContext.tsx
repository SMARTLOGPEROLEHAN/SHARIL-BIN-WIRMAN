import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '../lib/firebase';

export type UserRole = 'admin' | 'penginput' | 'penyemak' | 'pelulus' | 'pentadbir' | 'pelawat';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  office: string | null;
  state: string | null;
  district: string | null;
  loading: boolean;
  switchRole?: (newRole: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('pelawat');
  const [office, setOffice] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        
        const fEmail = (firebaseUser.email || '').trim().toLowerCase();
        const isDeveloperAdmin = fEmail === 'innogranite@gmail.com';
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        // Preload cached profile for immediate UI response
        try {
          const cachedRole = (localStorage.getItem(`risda_role_${firebaseUser.uid}`) as UserRole) || (isDeveloperAdmin ? 'admin' : 'pelawat');
          const cachedOffice = localStorage.getItem(`risda_office_${firebaseUser.uid}`) || null;
          const cachedState = localStorage.getItem(`risda_state_${firebaseUser.uid}`) || null;
          const cachedDistrict = localStorage.getItem(`risda_district_${firebaseUser.uid}`) || null;
          setRole(cachedRole);
          setOffice(cachedOffice);
          setState(cachedState);
          setDistrict(cachedDistrict);
        } catch {
          if (isDeveloperAdmin) setRole('admin');
        }

        try {
          // Fast-path: Check direct document by UID
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            const assignedRole: UserRole = (data.role as UserRole) || (isDeveloperAdmin ? 'admin' : 'pelawat');
            const assignedOffice = data.office || null;
            const assignedState = data.state || null;
            const assignedDistrict = data.district || null;

            setRole(assignedRole);
            setOffice(assignedOffice);
            setState(assignedState);
            setDistrict(assignedDistrict);

            // Cache in localStorage
            try {
              localStorage.setItem(`risda_role_${firebaseUser.uid}`, assignedRole);
              if (assignedOffice) localStorage.setItem(`risda_office_${firebaseUser.uid}`, assignedOffice);
              if (assignedState) localStorage.setItem(`risda_state_${firebaseUser.uid}`, assignedState);
              if (assignedDistrict) localStorage.setItem(`risda_district_${firebaseUser.uid}`, assignedDistrict);
            } catch {}
          } else {
            // Document does not exist yet by UID, check if user was pre-registered by email/staffId
            const querySnapshot = await getDocs(collection(db, 'users'));
            let matchedDocRef: any = null;
            let matchedDocData: any = null;

            querySnapshot.forEach((d) => {
              const data = d.data();
              const dEmail = (data.email || '').trim().toLowerCase();
              const dStaffId = (data.staffId || '').trim();
              const dUid = (data.uid || '').trim();
              
              if (
                d.id === firebaseUser.uid ||
                (fEmail && dEmail === fEmail) ||
                (dUid && dUid === firebaseUser.uid) ||
                (dStaffId && dStaffId === firebaseUser.uid)
              ) {
                if (!matchedDocData || data.role || data.office || data.displayName) {
                  matchedDocRef = d.ref;
                  matchedDocData = data;
                }
              }
            });

            if (matchedDocData) {
              const assignedRole: UserRole = (matchedDocData.role as UserRole) || (isDeveloperAdmin ? 'admin' : 'pelawat');
              const assignedOffice = matchedDocData.office || null;
              const assignedState = matchedDocData.state || null;
              const assignedDistrict = matchedDocData.district || null;
              const assignedName = matchedDocData.displayName || firebaseUser.displayName || 'Kakitangan';

              await setDoc(userDocRef, {
                ...matchedDocData,
                uid: firebaseUser.uid,
                email: firebaseUser.email || matchedDocData.email,
                displayName: assignedName,
                role: assignedRole,
                office: assignedOffice,
                state: assignedState,
                district: assignedDistrict,
                updatedAt: serverTimestamp()
              }, { merge: true });

              if (matchedDocRef && matchedDocRef.id !== firebaseUser.uid) {
                await deleteDoc(matchedDocRef).catch(() => null);
              }

              setRole(assignedRole);
              setOffice(assignedOffice);
              setState(assignedState);
              setDistrict(assignedDistrict);

              try {
                localStorage.setItem(`risda_role_${firebaseUser.uid}`, assignedRole);
                if (assignedOffice) localStorage.setItem(`risda_office_${firebaseUser.uid}`, assignedOffice);
                if (assignedState) localStorage.setItem(`risda_state_${firebaseUser.uid}`, assignedState);
                if (assignedDistrict) localStorage.setItem(`risda_district_${firebaseUser.uid}`, assignedDistrict);
              } catch {}
            } else {
              // Brand new user, create default document
              const defaultRole: UserRole = isDeveloperAdmin ? 'admin' : 'pelawat';
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || 'Kakitangan',
                role: defaultRole,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              setRole(defaultRole);
              setOffice(null);
              setState(null);
              setDistrict(null);

              try {
                localStorage.setItem(`risda_role_${firebaseUser.uid}`, defaultRole);
              } catch {}
            }
          }
        } catch (error: any) {
          console.warn('Notice retrieving user profile in AuthContext (running offline or network lag):', error);
          const fallbackRole: UserRole = isDeveloperAdmin ? 'admin' : ((localStorage.getItem(`risda_role_${firebaseUser.uid}`) as UserRole) || 'pelawat');
          setRole(fallbackRole);
          const fallbackOffice = localStorage.getItem(`risda_office_${firebaseUser.uid}`) || null;
          const fallbackState = localStorage.getItem(`risda_state_${firebaseUser.uid}`) || null;
          const fallbackDistrict = localStorage.getItem(`risda_district_${firebaseUser.uid}`) || null;
          setOffice(fallbackOffice);
          setState(fallbackState);
          setDistrict(fallbackDistrict);

          // Only invoke handleFirestoreError if this was NOT an offline connectivity error
          const msg = error instanceof Error ? error.message : String(error);
          if (!msg.includes('offline') && !msg.includes('unavailable') && !msg.includes('backend')) {
            try {
              handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
            } catch (err) {
              console.warn('Reported firestore error:', err);
            }
          }
        }
      } else {
        setUser(null);
        setRole('pelawat');
        setOffice(null);
        setState(null);
        setDistrict(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    if (user?.uid) {
      try {
        localStorage.setItem(`risda_role_${user.uid}`, newRole);
      } catch {}
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, office, state, district, loading, switchRole }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
