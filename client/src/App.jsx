import React, { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/Auth";
import { Loading, Empty } from "./components/UI";
const Landing = lazy(() => import("./pages/Landing")),
  AuthPage = lazy(() => import("./pages/AuthPage")),
  Shell = lazy(() => import("./components/Shell")),
  Dashboard = lazy(() => import("./pages/Dashboard")),
  TripPage = lazy(() => import("./pages/TripPage"));
const Admin = lazy(() => import("./pages/Admin"));
const other = (name) =>
  lazy(() => import("./pages/OtherPages").then((m) => ({ default: m[name] })));
const Profile = other("Profile"),
  AllReports = other("AllReports"),
  AllActivity = other("AllActivity"),
  Join = other("Join"),
  InfoPage = other("InfoPage");
function Protected() {
  const { user, loading } = useAuth();
  return loading ? (
    <Loading />
  ) : user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace />
  );
}
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Empty
        title="Something went wrong"
        text="Please reload Tripvero to try again."
        action={
          <button className="btn" onClick={() => location.reload()}>
            Reload
          </button>
        }
      />
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" toastOptions={{ duration: 4500 }} />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route
                path="/forgot-password"
                element={<AuthPage mode="forgot" />}
              />
              <Route
                path="/reset-password"
                element={<AuthPage mode="reset" />}
              />
              <Route path="/join" element={<Join />} />
              {["about", "help", "privacy", "terms"].map((type) => (
                <Route
                  key={type}
                  path={`/${type}`}
                  element={<InfoPage type={type} />}
                />
              ))}
              <Route element={<Protected />}>
                <Route path="/app" element={<Shell />}>
                  <Route index element={<Dashboard />} />
                  <Route path="trips" element={<Dashboard tripsOnly />} />
                  <Route path="trips/:tripId" element={<TripPage />} />
                  <Route path="reports" element={<AllReports />} />
                  <Route path="activity" element={<AllActivity />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="admin" element={<Admin />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
