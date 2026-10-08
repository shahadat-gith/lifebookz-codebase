import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import AppLayout, { AuthLayout, HomeLayout } from './components/layout/AppLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoadingScreen from './components/common/LoadingScreen';
import ScrollToTop from './components/common/ScrollToTop';
import { useAuth } from './context/AuthContext';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SessionWait = lazy(() => import('./pages/SessionWait'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

function LazyFallback() {
  return <LoadingScreen message="Loading..." />;
}

/**
 * The marketing home is for signed-out visitors only — a signed-in expert
 * never needs it, so it renders their dashboard instead.
 */
function HomeRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen message="Checking session..." />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route element={<HomeLayout />}>
            <Route
              path="/"
              element={
                <HomeRoute>
                  <Home />
                </HomeRoute>
              }
            />
          </Route>

          <Route element={<AppLayout />}>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            {/* Live sessions moved to consult.lifebookz.com — the dashboard's
                Join button runs the cross-subdomain handoff directly. */}
            {/* Live waiting room — where the expert tracks the client after
                confirming (client paying → client joined → join now). */}
            <Route
              path="/session-wait/:id"
              element={
                <ProtectedRoute>
                  <SessionWait />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <ProfileEdit />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          <Route
            path="*"
            element={
              <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                <h1 className="text-6xl font-bold">404</h1>
                <p className="text-muted-foreground">Page not found</p>
                <a href="/" className="text-primary hover:underline">
                  Go to Home
                </a>
              </div>
            }
          />
        </Routes>
      </Suspense>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '12px', padding: '12px 16px', fontSize: '14px' },
        }}
      />
    </>
  );
}
