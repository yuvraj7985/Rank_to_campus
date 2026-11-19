import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import AdminReports from './pages/AdminReports';
import {
  Predictor,
  Colleges,
  Preferences,
  Notifications,
  Profile,
  StudentAllocations,
  AdminStudents,
  AdminStudentDetails,
  AdminColleges,
  AdminRounds,
  AdminAllocations,
} from './pages/FeaturePages';
import { StudentDocuments as Documents, AdminDocuments } from './pages/DocumentPages';
import CutoffImport from './pages/CutoffImport';
import HistoricalCutoffs from './pages/HistoricalCutoffs';
import { useAuth } from './context/AuthContext';

function AdvisorRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/student'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/student" element={<Dashboard />} />
          <Route path="/student/allocations" element={<StudentAllocations />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/predictor" element={<Predictor />} />
          <Route path="/historical-cutoffs" element={<HistoricalCutoffs />} />
          <Route path="/colleges" element={<Colleges />} />
          <Route path="/preferences" element={<Preferences />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/ai-advisor" element={<AdvisorRedirect />} />
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/admin" element={<Dashboard admin />} />
            <Route path="/admin/rounds" element={<AdminRounds />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/students/:id" element={<AdminStudentDetails />} />
            <Route path="/admin/documents" element={<AdminDocuments />} />
            <Route path="/admin/colleges" element={<AdminColleges />} />
            <Route path="/admin/cutoffs/import" element={<CutoffImport />} />
            <Route path="/admin/allocations" element={<AdminAllocations />} />
            <Route path="/admin/ai-advisor" element={<AdvisorRedirect />} />
            <Route path="/admin/reports" element={<AdminReports />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
