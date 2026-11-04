# OpenAPI
## Test inventory FULL and DELTA

The inventory scenario script sends a representative FULL catalog followed by a
DELTA that updates price and stock, disables an item, and adds a new item.

Set INVENTORY_APP_SECRET in .env, choose a 99Food test store, and run:

    npm run test:inventory -- --store-id=156 --allow-full

The --allow-full option is mandatory because FULL can replace the complete
catalog of the selected store. To inspect both payloads without sending them:

    npm run test:inventory -- --store-id=156 --allow-full --dry-run

Run only one scenario with --scenario=full or --scenario=delta. Use
--base-url=https://your-api.example.com when testing a deployed environment.
The output includes the x-request-id returned by the API so each execution can
be found in the Inventory Activity screen. By default the script waits three
seconds between FULL and DELTA; customize this with --delay-ms=10000 if needed.

## DiDi: pruebas y produccion

La configuracion guarda dos pares independientes: appId/appSecret para produccion
(los campos existentes) y testAppId/testAppSecret para pruebas. Los App IDs deben
ser distintos. Un secreto vacio al editar conserva el valor guardado; cambiar el
App ID requiere proporcionar su secreto. Las respuestas de configuracion no
incluyen secretos. Grocery sigue usando las credenciales de produccion.

Ambos ambientes usan POST /didi/:slug/webhook y GET /didi/:slug/orders.
El app_id del webhook o x-app-id de la consulta selecciona el ambiente; la firma
se verifica exclusivamente con su secreto. Las consultas y claves de unicidad de
ordenes incluyen el ambiente. Test Mode y Allowed Test Shops restringen las
solicitudes de pruebas y la creacion de ordenes simuladas, sin detener produccion.
Los webhooks de ambos ambientes intentan confirmar usando sus propias credenciales.
Se conserva la URL upstream existente https://openapi.didi-food.com/v1: este cambio
separa credenciales y registros, no configura un servidor sandbox de DiDi.

Produccion requiere un proyecto activo, credenciales correctas, un webhook que
reciba los eventos de DiDi y autorizacion de la tienda para obtener su token.
El sistema verifica firma/app_id y procesa orderNew; no aplica una lista local
de tiendas de produccion ni reglas de inventario, horario o aprobacion manual.
Recibir y guardar el evento no garantiza su confirmacion: revisar Confirmed/Error.
El POST publico /orders conserva su comportamiento de simulacion, restringido a
Test Mode y tiendas permitidas; no es una ruta de creacion de ordenes reales.

Despliegue:

1. Revisar las credenciales existentes: se conservan como produccion. Si eran de
   pruebas, moverlas a los campos de pruebas y proporcionar las de produccion.
2. Aplicar la migracion con npx prisma migrate deploy --schema prisma/schema.prisma
   antes de arrancar la nueva version. Regenerar Prisma Client para el backend
   con el flujo de build del proyecto.
3. Revisar el historial: todos los registros anteriores se conservan con ambiente
   production porque no hay datos fiables para reconocer los simulados. Reclasificar
   los registros de prueba identificados antes de depender de consultas reales.
4. Guardar ambos pares en Edit DiDi Config. Para pruebas activar Test Mode y agregar
   tiendas permitidas. Verificar entrega de webhooks y confirmacion en cada ambiente.

Verificacion local sin llamadas a DiDi ni escrituras a la base de datos:

    npm --prefix backend run build
    node scripts/test-didi-environments.cjs
    npm --prefix frontend run build
