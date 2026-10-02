# 🏠 CasaFlow

> **Las horas de quienes cuidan tu casa, claras para todos.**
> Una app simple, linda y privada para registrar horas, liquidar pagos y no olvidarse de ningún viernes de pago.

---

## 📖 La historia

Todo empezó con una planilla. Cada semana, la misma pregunta: *¿cuántas horas trabajó cada una? ¿cuánto corresponde pagar? ¿ya pagué el viernes pasado?*

CasaFlow convierte ese ida y vuelta en algo simple:

- Las **colaboradoras** entran con un toque desde la tablet, cargan sus horas en 10 segundos y ven su propio calendario y el estado de sus pagos.
- Quien **organiza la casa** ve un tablero con gráficos, liquida entre las fechas que elija, y marca los pagos del **primer viernes de cada mes**.

Sin cuentas en la nube, sin suscripciones, sin datos viajando a ningún servidor.

## ✨ Qué hace

| Para el equipo 👩‍🔧 | Para quien organiza 🗂️ |
|---|---|
| Carga de horas en segundos, con chips rápidos | Tablero con KPIs, barras, dona y ritmo diario |
| Calendario personal tipo mapa de calor | Liquidación por período con recibo imprimible |
| Estado de sus pagos (sin ver montos ajenos) | Control de pagos del primer viernes de cada mes, con montos sugeridos |
| Mensajes e insights motivadores | Tarifas con **historial por fecha de vigencia** (aumentos de convenio) |
| | Equipo editable: altas, archivo, colores |
| | Registros filtrables, exportación y respaldo |

## ☁️ Dos modos de uso

| Modo local (sin configurar nada) | Modo nube (v2) |
|---|---|
| Los datos viven solo en el dispositivo (ideal: una tablet compartida en casa) | Cada colaboradora entra **desde su propio celular** con su cuenta de Google |
| Perfiles sin contraseña + PIN local para quien organiza | Quien organiza ve todo desde cualquier dispositivo; **cada persona ve solo lo suyo**, garantizado por reglas de seguridad |
| Respaldo JSON exportable/importable | Sincronización instantánea; respaldo exportable |

### Activar el modo nube (gratis, ~10 minutos)

1. Entrá a [console.firebase.google.com](https://console.firebase.google.com) con tu cuenta de Google → **Crear proyecto** (el plan gratuito alcanza de sobra para una casa).
2. En el proyecto: **Authentication → Comenzar → Google → Habilitar** (elegí tu mail de soporte) → Guardar.
3. **Authentication → Settings → Dominios autorizados → Agregar dominio**: `TU-USUARIO.github.io` (el dominio donde vive la app).
4. **Firestore Database → Crear base de datos → modo producción** → elegí una región cercana.
5. En Firestore, pestaña **Reglas**: pegá el contenido de [`firestore.rules`](firestore.rules) y publicá.
6. **Configuración del proyecto (⚙️) → Tus apps → Web (`</>`)** → registrá la app → copiá el objeto `firebaseConfig`.
7. Pegalo en [`js/firebase-config.js`](js/firebase-config.js) como `window.CASAFLOW_FIREBASE = { ... }` y subí el cambio.

Listo: la app pasa sola a modo nube. Quien entra primero crea su casa; después agrega a cada colaboradora con su **email de Google** desde *Equipo*, y ellas entran con ese mail.

> Las claves de `firebaseConfig` son públicas por diseño (identifican el proyecto, no dan acceso). La protección real está en `firestore.rules`: el dueño de cada casa ve y edita todo lo suyo; una colaboradora solo puede crear/ver **sus** horas y ver **sus** pagos — nunca tarifas ni datos de otras personas.

## 🔒 Privacidad primero

- En modo local, **nada sale del dispositivo**. En modo nube, los datos viven en **tu** proyecto de Firebase, bajo tu cuenta.
- El código es público; **tus datos no**. La demo trae un equipo ficticio (`?demo` en la URL fuerza el modo local de demostración).
- Exportá un **respaldo JSON** cuando quieras desde Ajustes.

## 📅 Días de pago

Se paga el **primer viernes de cada mes**. Los feriados cuentan como días hábiles: la fecha no se corre. En *Pagos* podés **quitar una fecha** puntual o **agregar una a mano** (adelanto, aguinaldo).

## 🗓️ Registros en calendario

En *Registros* cada día del mes muestra un "sticker" de color por colaboradora con sus horas. Los chips de arriba filtran por persona y muestran su total del mes; tocando un día ves el detalle, corregís o cargás horas.

## 🚀 Probarla

**Online**: **https://emilianocobe.github.io/casaflow/**

**Local**: cloná el repo y abrí `index.html` en el navegador. No hay build, no hay dependencias.

```bash
git clone https://github.com/emilianocobe/casaflow.git
cd casaflow
# abrí index.html — eso es todo
```

## 🛠️ Cómo está hecha

- **HTML + CSS + JavaScript puros.** Cero frameworks, cero dependencias, cero build.
- Gráficos **SVG dibujados a mano** (barras, dona, área, calendario de calor).
- Sistema de diseño con **tokens CSS**, modo claro/oscuro automático y `prefers-reduced-motion`.
- Enrutador por hash, estado en localStorage con exportación/importación versionada.

```
casaflow/
├── index.html            # estructura + sprite de iconos SVG
├── firestore.rules       # reglas de seguridad (modo nube)
├── css/styles.css        # sistema de diseño completo
└── js/
    ├── firebase-config.js  # configuración de la nube (opcional)
    ├── data.js             # modelo, adaptador local/nube, tarifas, calendario de pagos
    ├── charts.js           # gráficos SVG sin dependencias
    ├── cloud.js            # Firebase: ingreso con Google + sincronización
    └── app.js              # rutas, vistas, interacciones
```

## 🗺️ Mapa de ruta

- [x] ▓▓▓▓▓▓▓▓▓▓ **v1** — Perfiles, carga de horas, tablero, liquidación, pagos, tarifas con vigencia, respaldo
- [x] ▓▓▓▓▓▓▓▓▓▓ **v2** — Sincronización en la nube (cuentas Google, cada una desde su celular) + calendario de pagos configurable
- [ ] ░░░░░░░░░░ **v2.1** — Instalable como app (PWA) y uso offline
- [ ] ░░░░░░░░░░ **v2.2** — Recordatorios de día de pago

## 📚 Glosario

| Término | Qué significa |
|---|---|
| **Liquidación** | Horas trabajadas × tarifa vigente, en un período elegido |
| **Período** | Las fechas Desde y Hasta que elegís en el tablero y en la liquidación |
| **Tarifa vigente** | El valor por hora que aplicaba en cada fecha; los aumentos no pisan el pasado |
| **Día de pago** | El primer viernes de cada mes (los feriados cuentan como hábiles) |
| **Respaldo** | Archivo JSON con todos tus datos, portable a otro dispositivo |

## 🤝 Licencia

MIT — usala, adaptala, mejorala.

---

*Hecho con cariño para las casas que funcionan gracias a su gente.* 💜
