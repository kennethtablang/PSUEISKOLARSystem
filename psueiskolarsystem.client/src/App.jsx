import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import ScholarsPage from './pages/ScholarsPage';
import ScholarDetailPage from './pages/ScholarDetailPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import MyDocumentsPage from './pages/MyDocumentsPage';
import DocumentReviewPage from './pages/DocumentReviewPage';
import RequirementsPage from './pages/RequirementsPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ProfilePage from './pages/ProfilePage';

const admin = ['Administrator'];
const adminCoord = ['Administrator', 'ScholarshipCoordinator'];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute roles={admin}><UsersPage /></ProtectedRoute>} />
          <Route path="/scholars" element={<ProtectedRoute roles={adminCoord}><ScholarsPage /></ProtectedRoute>} />
          <Route path="/scholars/:userId" element={<ProtectedRoute roles={adminCoord}><ScholarDetailPage /></ProtectedRoute>} />
          <Route path="/my-profile" element={<ProtectedRoute><ScholarDetailPage /></ProtectedRoute>} />
          <Route path="/my-documents" element={<ProtectedRoute roles={['Scholar']}><MyDocumentsPage /></ProtectedRoute>} />
          <Route path="/document-review" element={<ProtectedRoute roles={adminCoord}><DocumentReviewPage /></ProtectedRoute>} />
          <Route path="/requirements"  element={<ProtectedRoute roles={admin}><RequirementsPage /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute roles={adminCoord}><AnnouncementsPage /></ProtectedRoute>} />
          <Route path="/analytics"    element={<ProtectedRoute roles={adminCoord}><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/profile"      element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
