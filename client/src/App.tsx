import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import Header from "./components/layout/Header";
import ScrollToTop from "./components/layout/ScrollToTop";
import CartDrawer from "./components/cart/CartDrawer";
import CarritoFlotante from "./components/cart/CarritoFlotante";
import WhatsappFloatButton from "./components/layout/WhatsappFloatButton";
import ScrollToTopButton from "./components/layout/ScrollToTopButton";
import HomePage from "./pages/HomePage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ResumePage from "./pages/ResumePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MiCuentaPage from "./pages/MiCuentaPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import TerminosCondicionesPage from "./pages/TerminosCondicionesPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
  const location = useLocation();
  const headerVariant = location.pathname === "/resumen" ? "light" : "full";

  return (
    <AuthProvider>
      <CartProvider>
        <ScrollToTop />
        <Header variant={headerVariant} />
        {location.pathname !== "/resumen" && <WhatsappFloatButton />}
        {(location.pathname === "/" ||
          location.pathname.startsWith("/productos")) && <ScrollToTopButton />}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/productos/:categoriaId" element={<ProductsPage />} />
          <Route path="/productos/panel/:panelId" element={<ProductsPage />} />
          <Route path="/producto/:productoId" element={<ProductDetailPage />} />
          <Route path="/resumen" element={<ResumePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route
            path="/mi-cuenta"
            element={
              <ProtectedRoute>
                <MiCuentaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/terminos-y-condiciones"
            element={<TerminosCondicionesPage />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        {(location.pathname === "/" ||
          location.pathname.startsWith("/producto")) && <CarritoFlotante />}
        <CartDrawer />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
