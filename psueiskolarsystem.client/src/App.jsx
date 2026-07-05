import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { TutorialProvider } from './context/TutorialContext';
import ConsentGate from './components/ConsentGate';
import { Clock } from 'lucide-react';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import ScholarsPage from './pages/ScholarsPage';
import ScholarDetailPage from './pages/ScholarDetailPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import MyDocumentsPage from './pages/MyDocumentsPage';
import DocumentReviewPage from './pages/DocumentReviewPage';
import RequirementsPage from './pages/RequirementsPage';
import DeadlinesPage from './pages/DeadlinesPage';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import ScholarshipTypesPage from './pages/ScholarshipTypesPage';
import SettingsPage from './pages/SettingsPage';
import ActivityLogPage from './pages/ActivityLogPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ProfilePage from './pages/ProfilePage';

const admin = ['Administrator'];
const adminCoord = ['Administrator', 'ScholarshipCoordinator'];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <NotificationProvider>
      <TutorialProvider>
        <SessionExpiredModal />
        <ConsentGate />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute roles={admin}><UsersPage /></ProtectedRoute>} />
          <Route path="/scholars" element={<ProtectedRoute roles={adminCoord}><ScholarsPage /></ProtectedRoute>} />
          <Route path="/scholars/:userId" element={<ProtectedRoute roles={adminCoord}><ScholarDetailPage /></ProtectedRoute>} />
          <Route path="/my-profile" element={<ProtectedRoute><ScholarDetailPage /></ProtectedRoute>} />
          <Route path="/my-documents" element={<ProtectedRoute roles={['Scholar']}><MyDocumentsPage /></ProtectedRoute>} />
          <Route path="/document-review" element={<ProtectedRoute roles={adminCoord}><DocumentReviewPage /></ProtectedRoute>} />
          <Route path="/deadlines" element={<ProtectedRoute roles={adminCoord}><DeadlinesPage /></ProtectedRoute>} />
          <Route path="/requirements"       element={<ProtectedRoute roles={admin}><RequirementsPage /></ProtectedRoute>} />
          <Route path="/scholarship-types"  element={<ProtectedRoute roles={admin}><ScholarshipTypesPage /></ProtectedRoute>} />
          <Route path="/settings"      element={<ProtectedRoute roles={admin}><SettingsPage /></ProtectedRoute>} />
          <Route path="/activity-log" element={<ProtectedRoute roles={admin}><ActivityLogPage /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute roles={adminCoord}><AnnouncementsPage /></ProtectedRoute>} />
          <Route path="/analytics"    element={<ProtectedRoute roles={adminCoord}><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/messages"     element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/profile"      element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </TutorialProvider>
      </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function SessionExpiredModal() {
  const { sessionExpired, setSessionExpired } = useAuth();
  const navigate = useNavigate();

  if (!sessionExpired) return null;

  function handleDismiss() {
    setSessionExpired(false);
    navigate('/login', { replace: true });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4"
      style={{ background: 'rgba(0,20,60,0.6)' }}>
      <div className="clay-card-modal w-full p-8 text-center" style={{ maxWidth: 380 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(0,37,112,0.08)', border: '2px solid rgba(0,37,112,0.15)' }}>
          <Clock size={26} color="#002570" strokeWidth={2} />
        </div>
        <p className="font-black text-lg mb-2" style={{ color: 'var(--text-strong)' }}>Session Expired</p>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text)' }}>
          You have been signed out due to 30 minutes of inactivity. Please sign in again to continue.
        </p>
        <button
          onClick={handleDismiss}
          className="clay-btn clay-btn-primary w-full py-3 text-sm">
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
