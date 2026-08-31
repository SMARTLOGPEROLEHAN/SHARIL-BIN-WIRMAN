import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '../lib/firebase';

export type UserRole = 'admin' | 'penginput' | 'pelulus' | 'pentadbir' | 'pelawat';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  office: string | null;
  state: string | null;
  district: string | null;
  loading: boolean;
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
        
        let userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          let userDoc = await getDoc(userDocRef);
          
          // Find any registered staff document matching email (case-insensitive), uid, or staffId
          const querySnapshot = await getDocs(collection(db, 'users'));
          let matchedDocRef: any = null;
          let matchedDocData: any = null;
          
          const fEmail = (firebaseUser.email || '').trim().toLowerCase();
          
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
              // Prefer document that has explicit admin-assigned details (role, displayName, office)
              if (!matchedDocData || data.role || data.office || data.displayName) {
                matchedDocRef = d.ref;
                matchedDocData = data;
              }
            }
          });

          if (matchedDocData) {
            // Determine exact role, name, office, state, and district registered by admin
            const assignedRole: UserRole = (matchedDocData.role as UserRole) || (fEmail === 'innogranite@gmail.com' ? 'admin' : 'pelawat');
            const assignedOffice = matchedDocData.office || null;
            const assignedState = matchedDocData.state || null;
            const assignedDistrict = matchedDocData.district || null;
            const assignedName = matchedDocData.displayName || firebaseUser.displayName || 'Kakitangan';

            // Sync/Merge into primary document at users/${firebaseUser.uid}
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

            // If matched document was at a different document ID (e.g. pre-registered slug), remove old duplicate
            if (matchedDocRef && matchedDocRef.id !== firebaseUser.uid) {
              await deleteDoc(matchedDocRef).catch(() => null);
            }

            // Set state in AuthContext
            setRole(assignedRole);
            setOffice(assignedOffice);
            setState(assignedState);
            setDistrict(assignedDistrict);
          } else {
            // No registered document found anywhere, create default document
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
              const defaultRole: UserRole = fEmail === 'innogranite@gmail.com' ? 'admin' : 'pelawat';
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
            } else {
              const d = userDoc.data();
              setRole((d.role as UserRole) || 'pelawat');
              setOffice(d.office || null);
              setState(d.state || null);
              setDistrict(d.district || null);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setRole('pelawat');
          setOffice(null);
          setState(null);
          setDistrict(null);
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

  return (
    <AuthContext.Provider value={{ user, role, office, state, district, loading }}>
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
