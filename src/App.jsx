import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Nav from './components/Nav';
import Footer from './components/Footer';

// Code-split each route into its own chunk so the first load only ships the
// shell + the landing page, not the whole app (Stripe, calendar, admin, etc.).
const Home = lazy(() => import('./pages/Home'));
const Book = lazy(() => import('./pages/Book'));
const Confirm = lazy(() => import('./pages/Confirm'));
const Memberships = lazy(() => import('./pages/Memberships'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Admin = lazy(() => import('./pages/Admin'));
const Profile = lazy(() => import('./pages/Profile'));
const Pay = lazy(() => import('./pages/Pay'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <>
      <Nav />
      <main className="page">
        <Suspense fallback={<div className="loading-center"><div className="spinner" /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book" element={<Book />} />
            <Route path="/memberships" element={<Memberships />} />
            <Route path="/confirm/:id" element={<Confirm />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/pay/:id" element={<Pay />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
