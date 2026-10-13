import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/routes/LoginPage';
import { RegisterPage } from '@/routes/RegisterPage';
import { DashboardPage } from '@/routes/DashboardPage';
import { AnalysisPage } from '@/routes/AnalysisPage';
import { FarmsPage } from '@/routes/FarmsPage';
import { CropCyclesPage } from '@/routes/CropCyclesPage';
import { HarvestPage } from '@/routes/features/HarvestPage';
import { SoilPage } from '@/routes/features/SoilPage';
import { DiseasePage } from '@/routes/features/DiseasePage';
import { RejuvenationPage } from '@/routes/features/RejuvenationPage';
import { OfflinePage } from '@/routes/features/OfflinePage';
import { PredictionsHistoryPage } from '@/routes/predictions/HistoryPage';
import { PredictionDetailPage } from '@/routes/predictions/DetailPage';
import { AdminFarmersPage } from '@/routes/admin/AdminFarmersPage';
import { AdminReferencePage } from '@/routes/admin/AdminReferencePage';
import { AdminAuditPage } from '@/routes/admin/AdminAuditPage';
import { NotFoundPage } from '@/routes/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'analysis', element: <AnalysisPage /> },
          { path: 'farms', element: <FarmsPage /> },
          { path: 'crop-cycles', element: <CropCyclesPage /> },
          { path: 'predictions', element: <PredictionsHistoryPage /> },
          { path: 'predictions/:id', element: <PredictionDetailPage /> },
          { path: 'features/harvest', element: <HarvestPage /> },
          { path: 'features/soil', element: <SoilPage /> },
          { path: 'features/disease', element: <DiseasePage /> },
          { path: 'features/rejuvenation', element: <RejuvenationPage /> },
          { path: 'features/offline', element: <OfflinePage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute roles={['admin', 'superadmin']} />,
    children: [
      {
        element: <Layout />,
        children: [{ path: 'admin/farmers', element: <AdminFarmersPage /> }],
      },
    ],
  },
  {
    element: <ProtectedRoute roles={['superadmin']} />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: 'admin/reference', element: <AdminReferencePage /> },
          { path: 'admin/audit', element: <AdminAuditPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
