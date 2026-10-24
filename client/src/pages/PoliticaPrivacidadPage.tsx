import { Link } from 'react-router-dom'
import { useConfiguracionTienda } from '../hooks/useConfiguracionTienda'
import {
  PaginaLegal,
  SeccionLegal,
  Parrafo,
  Lista,
  DatosResponsable,
  MedioContacto,
  claseLink,
} from '../components/common/PaginaLegal'

// Borrador según la guía de auditoría (sección 15.4, Ley 25.326). Genérico:
// los datos del responsable salen de configuracion_tienda. El texto definitivo
// lo revisa el desarrollador antes de entregar a un cliente.

export default function PoliticaPrivacidadPage() {
  const { config } = useConfiguracionTienda()

  return (
    <PaginaLegal titulo="Política de privacidad" actualizado="octubre de 2026">
      <SeccionLegal titulo="Responsable de tus datos">
        <Parrafo>
          El responsable de la base de datos donde se guarda tu información es:
        </Parrafo>
        <DatosResponsable config={config} />
      </SeccionLegal>

      <SeccionLegal titulo="Qué datos guardamos">
        <Lista
          items={[
            'Al reservar: nombre y apellido, teléfono y email.',
            'El detalle de tus reservas: productos, cantidades, precios, fecha y estado.',
            'Si creás una cuenta: además, tu email de acceso y tu contraseña, que se guarda cifrada y nadie de la tienda puede ver.',
          ]}
        />
        <Parrafo>
          Nombre, teléfono y email son obligatorios para reservar: sin ellos no podemos gestionar
          la reserva ni avisarte cuando está lista. Crear una cuenta es opcional.
        </Parrafo>
      </SeccionLegal>

      <SeccionLegal titulo="Para qué los usamos">
        <Lista
          items={[
            'Gestionar tus reservas y prepararlas para el retiro.',
            'Contactarte por WhatsApp o email sobre el estado de tu reserva.',
            'Mostrarte tu historial de reservas si tenés una cuenta.',
          ]}
        />
        <Parrafo>
          No usamos tus datos para publicidad y no los vendemos ni los cedemos a terceros.
          Las listas de clientes que se exportan desde el panel de la tienda son solo para uso interno.
        </Parrafo>
      </SeccionLegal>

      <SeccionLegal titulo="Dónde se guardan">
        <Parrafo>
          Usamos proveedores de servicios en la nube para alojar el sitio, guardar la base de datos,
          manejar el inicio de sesión y enviar emails. Algunos de esos proveedores tienen sus
          servidores fuera de Argentina; solo tratan tus datos para prestarnos esos servicios.
        </Parrafo>
        <Parrafo>
          Protegemos la información con conexión cifrada (HTTPS), base de datos cifrada y permisos que
          limitan quién puede ver cada dato: solo el personal de la tienda accede a las reservas.
        </Parrafo>
        <Parrafo>
          El sitio guarda en tu navegador la información necesaria para mantener tu sesión iniciada.
          No usamos cookies de publicidad ni de seguimiento.
        </Parrafo>
      </SeccionLegal>

      <SeccionLegal titulo="Cuánto tiempo los guardamos">
        <Parrafo>
          Mientras tengas una cuenta, o el tiempo necesario para gestionar tus reservas y cumplir con
          nuestras obligaciones legales. Después los borramos o los anonimizamos.
        </Parrafo>
      </SeccionLegal>

      <SeccionLegal titulo="Tus derechos">
        <Parrafo>
          Podés pedirnos en cualquier momento acceder a tus datos, corregirlos, actualizarlos o
          eliminarlos, escribiendo a <MedioContacto config={config} />. El acceso es gratuito
          cada seis meses, salvo que acredites un interés legítimo para pedirlo antes (Ley 25.326).
          Respondemos los pedidos de acceso dentro de los 10 días corridos y los de rectificación o
          supresión dentro de los 5 días hábiles.
        </Parrafo>
        <Parrafo>
          Si tenés una cuenta, también podés editar tu nombre, apellido y teléfono desde{' '}
          <Link to="/mi-cuenta" className={claseLink}>Mi cuenta</Link>.
        </Parrafo>
        <Parrafo>
          La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la
          Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan
          quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en
          materia de protección de datos personales.
        </Parrafo>
      </SeccionLegal>

      <SeccionLegal titulo="Cambios en esta política">
        <Parrafo>
          Si cambiamos esta política, publicamos la nueva versión en esta página con su fecha de
          actualización. Ver también los{' '}
          <Link to="/terminos-y-condiciones" className={claseLink}>Términos y Condiciones</Link>.
        </Parrafo>
      </SeccionLegal>
    </PaginaLegal>
  )
}
