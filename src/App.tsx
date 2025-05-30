import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Login from './pages/auth/Login'
import BaseLayout from './layouts/BaseLayout'
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
// import TellerUsers from './pages/admin/users/Tellers'

export default function App () {
  return (
    <BaseLayout>
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
          <Route path='users/admins' element={<AdminUsers />} />
          <Route path='credits' element={<CreditPaymentsScreen />} />
          {/* Add more routes here as needed */}
        </Route>
        {/* Teller Routes */}
        <Route path='/tellers' element={<SystemLayout />}>
          <Route index element={<SaleScreen />} />
        </Route>
        <Route path='/cashin' element={<SystemLayout />}>
          <Route index element={<CashInScreen />} />
        </Route>
      </Routes>
    </BaseLayout>
  )
}
