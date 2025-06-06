import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Login from './pages/auth/Login'
import Register from './pages/auth/registration'
import Onboarding from './pages/auth/onboarding'
import SystemLayout from './layouts/SystemLayout'
import AdminDashboard from './pages/admin'
import AdminUsers from './pages/admin/users/admins'
import TellersPage from './pages/admin/users/tellers'
import ProductsPage from './pages/admin/products'
import CreditPaymentsScreen from './pages/admin/credits'
import CashInScreen from './pages/cashin'
import SaleScreen from './pages/tellers/pos'
import { ConfigProvider, App as AntdApp } from 'antd'
import ExpenseCaptureList from './pages/admin/expenses'
import DrawingsForm from './pages/drawings'
import AnalyticsPage from './pages/analytics'

export default function App () {
  return (
    <ConfigProvider>
      <AntdApp>
        <Routes>
          <Route path='/' element={<LandingPage />} />

          {/* Auth Routes */}
          <Route path='/auth/login' element={<Login />} />
          <Route path='/auth/registration' element={<Register />} />
          <Route path='/auth/onboarding' element={<Onboarding />} />

          {/* Admin Routes */}
          <Route path='/admin' element={<SystemLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path='users/admins' element={<AdminUsers />} />
            <Route path='users/tellers' element={<TellersPage />} />
            <Route path='products' element={<ProductsPage />} />
            <Route path='credits' element={<CreditPaymentsScreen />} />
            <Route path='expenses' element={<ExpenseCaptureList />} />{' '}
            {/* Add more routes here as needed */}
          </Route>
          {/* Teller Routes */}
          <Route path='/tellers' element={<SystemLayout />}>
            <Route index element={<SaleScreen />} />
          </Route>
          <Route path='/cashin' element={<SystemLayout />}>
            <Route index element={<CashInScreen />} />
          </Route>
          <Route path='/drawings' element={<SystemLayout />}>
            <Route index element={<DrawingsForm />} />
          </Route>
          <Route path='/analytics' element={<SystemLayout />}>
            <Route index element={<AnalyticsPage />} />
          </Route>
        </Routes>
      </AntdApp>
    </ConfigProvider>
  )
}
