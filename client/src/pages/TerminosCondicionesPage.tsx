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

// Borrador según la guía de auditoría (secciones 15.1, 15.2, 15.3 y 15.5):
// la reserva no es una venta a distancia; el contrato se celebra en el local.
// El texto definitivo lo revisa el desarrollador antes de entregar a un cliente.
// Los datos del negocio salen de configuracion_tienda, nunca del código.

export default function TerminosCondicionesPage() {
  const { config } = useConfiguracionTienda()
  const tienda = config?.nombre_tienda || 'la tienda'

  return (
    <PaginaLegal titulo="Términos y Condiciones" actualizado="octubre de 2026">
      <SeccionLegal titulo="Quiénes somos">
        <Parrafo>
          Este sitio es de {tienda}. Al usarlo aceptás estos Términos y Condiciones.
          Si no estás de acuerdo con ellos, te pedimos que no lo uses.
        </Parrafo>
        <DatosResponsable config={config} />
      </SeccionLegal>

      <SeccionLegal titulo="Cómo funciona la reserva">
        <Parrafo>
          En este sitio podés armar una reserva de productos para retirar en nuestros locales.
          La reserva es una solicitud: no implica ningún pago ni te obliga a comprar.
        </Parrafo>
        <Lista
          items={[
            'No cobramos online ni hacemos envíos: el pago y la entrega se hacen en el local.',
            'La compraventa se celebra en el local, cuando ves el producto, lo pagás y lo retirás.',
            'Te avisamos por WhatsApp o email cuando confirmamos la reserva y cuando está lista para retirar.',
            'Si cambiás de opinión, no tenés que hacer nada más que no retirarla; si nos avisás, mejor, así liberamos los productos.',
          ]}
        />
      </SeccionLegal>

      <SeccionLegal titulo="Disponibilidad y precios">
        <Lista
          items={[
            'Todas las reservas están sujetas a la disponibilidad de stock al momento de confirmarlas.',
            'Respetamos el precio que figura al momento de hacer la reserva hasta la fecha de retiro que acordemos con vos.',
            'Si un producto no está disponible, te avisamos y podés mantener el resto de la reserva o cancelarla.',
          ]}
        />
      </SeccionLegal>

      <SeccionLegal titulo="Errores de precio">
        <Parrafo>
          Si un precio publicado tiene un error evidente y reconocible (por ejemplo, un cero de menos),
          ese precio no nos obliga, según los artículos 265 y 266 del Código Civil y Comercial.
          En ese caso te avisamos antes del retiro y podés mantener la reserva con el precio correcto
          o cancelarla sin ningún costo.
        </Parrafo>
      </SeccionLegal>

      <SeccionLegal titulo="Productos y uso responsable">
        <Parrafo>
          Todos los productos que ofrecemos son de venta legal en Argentina y están destinados a
          cultivo, jardinería, iluminación y accesorios. Cada persona es responsable del uso que les da.
        </Parrafo>
        <Parrafo>
          Los productos para fumar (papelillos, filtros y similares) solo se venden a mayores de 18 años:
          al retirar podemos pedirte un documento.
        </Parrafo>
      </SeccionLegal>

      <SeccionLegal titulo="Tu cuenta">
        <Parrafo>
          Podés reservar sin crear una cuenta. Si la creás, vas a poder ver el historial de tus
          reservas y no vas a tener que cargar tus datos cada vez. Sos responsable de mantener tu
          contraseña en secreto y de que los datos que cargues sean correctos.
        </Parrafo>
        <Parrafo>
          Cómo usamos tus datos está explicado en la{' '}
          <Link to="/politica-de-privacidad" className={claseLink}>Política de privacidad</Link>.
        </Parrafo>
      </SeccionLegal>

      <SeccionLegal titulo="Consultas y reclamos">
        <Parrafo>
          Para cualquier consulta o reclamo escribinos a <MedioContacto config={config} />.
          También podés acudir a la autoridad de Defensa del Consumidor de tu jurisdicción.
        </Parrafo>
        <Parrafo>
          Podemos actualizar estos Términos; la versión vigente es siempre la publicada en esta página.
          Las reservas ya hechas se rigen por los Términos vigentes al momento de hacerlas.
        </Parrafo>
      </SeccionLegal>
    </PaginaLegal>
  )
}
