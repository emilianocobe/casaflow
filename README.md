# 🏠 CasaFlow

> **Las horas de quienes cuidan tu casa, claras para todos.**
> Una app simple, linda y privada para registrar horas, liquidar pagos y no olvidarse de ningún viernes de pago.

---

## 📖 La historia

Todo empezó con una planilla. Cada semana, la misma pregunta: *¿cuántas horas trabajó cada una? ¿cuánto corresponde pagar? ¿ya pagué el viernes pasado?*

CasaFlow convierte ese ida y vuelta en algo simple:

- Las **colaboradoras** entran con un toque desde la tablet, cargan sus horas en 10 segundos y ven su propio calendario y el estado de sus pagos.
- Quien **organiza la casa** ve un tablero con gráficos, liquida por semana, quincena o mes, y marca los pagos de cada **2º y 4º viernes**.

Sin cuentas en la nube, sin suscripciones, sin datos viajando a ningún servidor.

## ✨ Qué hace

| Para el equipo 👩‍🔧 | Para quien organiza 🗂️ |
|---|---|
| Carga de horas en segundos, con chips rápidos | Tablero con KPIs, barras, dona y ritmo diario |
| Calendario personal tipo mapa de calor | Liquidación por período con recibo imprimible |
| Estado de sus pagos (sin ver montos ajenos) | Control de pagos del 2º y 4º viernes, con montos sugeridos |
| Mensajes e insights motivadores | Tarifas con **historial por fecha de vigencia** (aumentos de convenio) |
| | Equipo editable: altas, archivo, colores |
| | Registros filtrables, exportación y respaldo |

## 🔒 Privacidad primero

- **Los datos viven solo en tu dispositivo** (localStorage del navegador). Nada se envía a ningún servidor.
- El código es público; **tus datos no**. La demo trae un equipo ficticio.
- La vista de organización se protege con un **PIN local** (traba amable para uso hogareño, no un sistema de seguridad bancario — honestidad ante todo).
- Exportá un **respaldo JSON** cuando quieras desde Ajustes.

## 🚀 Probarla

**Online**: _(GitHub Pages — link al publicar)_

**Local**: cloná el repo y abrí `index.html` en el navegador. No hay build, no hay dependencias.

```bash
git clone https://github.com/TU-USUARIO/casaflow.git
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
├── index.html        # estructura + sprite de iconos SVG
├── css/styles.css    # sistema de diseño completo
└── js/
    ├── data.js       # modelo, storage, tarifas vigentes, días de pago
    ├── charts.js     # gráficos SVG sin dependencias
    └── app.js        # rutas, vistas, interacciones
```

## 🗺️ Mapa de ruta

- [x] ▓▓▓▓▓▓▓▓▓▓ **v1** — Perfiles, carga de horas, tablero, liquidación, pagos, tarifas con vigencia, respaldo
- [ ] ░░░░░░░░░░ **v1.1** — Instalable como app (PWA) y uso 100% offline
- [ ] ░░░░░░░░░░ **v1.2** — Recordatorios de día de pago
- [ ] ░░░░░░░░░░ **v2** — Sincronización multi-dispositivo opcional (backend)

## 📚 Glosario

| Término | Qué significa |
|---|---|
| **Liquidación** | Horas trabajadas × tarifa vigente, en un período elegido |
| **Quincena** | Del 1 al 15 (Q1) y del 16 a fin de mes (Q2) |
| **Tarifa vigente** | El valor por hora que aplicaba en cada fecha; los aumentos no pisan el pasado |
| **Día de pago** | El 2º y el 4º viernes de cada mes |
| **Respaldo** | Archivo JSON con todos tus datos, portable a otro dispositivo |

## 🤝 Licencia

MIT — usala, adaptala, mejorala.

---

*Hecho con cariño para las casas que funcionan gracias a su gente.* 💜
