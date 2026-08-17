import { Routes, Route } from 'react-router-dom'
import { ConfirmProvider } from './context/ConfirmContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import OrdersPage from './pages/OrdersPage'
import SettingsPage from './pages/SettingsPage'
import PanelsPage from './pages/PanelsPage'
import CustomersPage from './pages/CustomersPage'

function App() {
  return (
    <ConfirmProvider>
      <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/pedidos" element={<OrdersPage />} />
            <Route path="/paneles" element={<PanelsPage />} />
            <Route path="/configuracion" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
    </ConfirmProvider>
  )
}

export default App
