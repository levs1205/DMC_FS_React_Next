import { BookingPage } from './pages/BookingPage';
import { LoginPage } from './pages/LoginPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;

