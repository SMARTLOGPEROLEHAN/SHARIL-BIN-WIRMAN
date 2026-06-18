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
          
          if (!userDoc.exists() && firebaseUser.email) {
            // Find pre-registered document that matches the email and doesn't have a real synced UID yet
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
            const querySnapshot = await getDocs(q);
            
            let emailDocRef = null;
            let emailDocData = null;
            
            querySnapshot.forEach((d) => {
              const data = d.data();
              // A pre-registered user has either no UID, or their UID is equal to their document ID
              if (!data.uid || data.uid === d.id || data.uid === firebaseUser.email.replace(/[^a-zA-Z0-9]/g, '_')) {
                emailDocRef = d.ref;
                emailDocData = data;
              }
            });
            
            if (emailDocRef && emailDocData) {
              await setDoc(userDocRef, {
                ...emailDocData,
                uid: firebaseUser.uid,
                updatedAt: serverTimestamp()
              });
              await deleteDoc(emailDocRef);
              
              setRole(emailDocData.role as UserRole);
              setOffice(emailDocData.office || null);
              setState(emailDocData.state || null);
              setDistrict(emailDocData.district || null);
              setLoading(false);
              return;
            }
          }

          if (userDoc.exists()) {
            const data = userDoc.data();
            let activeRole = (data.role as UserRole) || 'pelawat';
            
            // DATA CORRECTION: SHARIL WIRMAN (Pelulus -> Penginput)
            if (activeRole === 'pelulus' && data.displayName?.toUpperCase().includes('SHARIL WIRMAN')) {
              activeRole = 'penginput';
              // Update database to persist this change
              updateDoc(userDocRef, { 
                role: 'penginput',
                updatedAt: serverTimestamp()
              }).catch(e => console.error("Self-correction failed:", e));
            }

            setRole(activeRole);
            setOffice(data.office || null);
            setState(data.state || null);
            setDistrict(data.district || null);
          } else {
            const newRole = firebaseUser.email === 'innogranite@gmail.com' ? 'admin' : 'pelawat';
            if (newRole === 'admin') {
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                role: newRole,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            }
            setRole(newRole);
            setOffice(null);
            setState(null);
            setDistrict(null);
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
