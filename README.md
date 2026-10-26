# 🏠 CasaFlow

> **Los bloques de quienes cuidan tu casa, claros para todos.**
> Reservas por turnos, presentismo de un toque y liquidación automática.

**Online**: **https://emilianocobe.github.io/casaflow/**

---

## 🔀 Transición: app vieja → app nueva

La primera pantalla deja elegir entre las dos apps. Cada una tiene **sus propios datos**.

| | App vieja (`/vieja/`) | App nueva (`/nueva/`) |
|---|---|---|
| Para qué | Cerrar **octubre 2026**: horas libres, liquidación y pagos | Bloques de mañana y tarde desde **noviembre 2026** |
| Hasta cuándo | Visible hasta el **viernes 30/10/2026** | Desde el **sábado 31/10** se abre directo; desde el **lunes 2/11**, la única |
| Cambios | Congelada: no se modifica más | Acá sigue la evolución |

La fecha de corte está en `index.html` (`window.VIEJA_HASTA`). Pasado ese día, `/casaflow/` abre directo la app nueva (con `?elegir` se puede volver a ver el selector).

## ✨ App nueva: qué hace

**Bloques**: Mañana 8 a 13 (5 h) y Tarde 13 a 19 (6 h), de lunes a domingo. Cupo: **1 titular + 1 lugar de shadow** (para entrenar), que la administración habilita bloque por bloque.

| Para el equipo 👩‍🔧 (celular) | Para la administración 🗂️ |
|---|---|
| **Reservar**: agenda semanal con botones grandes y progreso hacia el mínimo | **Hoy**: presente con un toque (Asistió / Parcial / No asistió) |
| Turnos por prioridad para titulares; **lugares de shadow sin turno** | **Planificación**: calendario del mes, abrir/cerrar reservas, turnos, bloques cerrados, lugares de shadow |
| **Mis bloques**: próximo bloque, cambiar o liberar hasta 24 h antes, pedir horas extra | **Equipo**: orden de prioridad, mínimo y máximo **por semana**, permisos titular/shadow, tarifas con vigencia |
| Ve "ocupado" sin nombres de las demás, y nunca montos | **Liquidación**: sale sola del presente; extras a aprobar; marcar pagado |

### Reglas del sistema

- Los bloques de titular se eligen **por turnos** en el orden de Equipo: cuando una cubre su mínimo de todas las semanas completas del mes, le toca a la siguiente; después, **ronda 2** hasta el máximo.
- Los **lugares de shadow** se toman apenas se habilitan, sin turno.
- Mínimo y máximo **por semana** (lunes a domingo), contando titular y shadow. Las semanas que no caen enteras en el mes no exigen mínimo.
- En un mes ya cerrado, cada una puede **cambiar o liberar** un bloque hasta **24 h antes**.
- Las faltas no se pagan; lo que no tiene presente tomado no se cuenta; las horas extra cuentan cuando se aprueban.

## ☁️ Nube y seguridad

Las dos apps usan el mismo proyecto de Firebase (`casaflow-7c970`) pero **colecciones separadas**:
la vieja usa `houses/` e `invites/`; la nueva, `hogares/` e `invitaciones/`. Por eso la app nueva arranca en blanco.

La protección está en [`firestore.rules`](firestore.rules) (cubre las dos apps). Cada vez que cambia, hay que **pegarlo en Firebase → Firestore → Reglas → Publicar**. La administración ve y edita todo lo de su hogar; una colaboradora reserva solo a su nombre, en meses con reservas abiertas, con su permiso de titular o shadow, y nunca ve tarifas ni datos de otras personas.

## 🧪 Probar sin tocar datos reales

Abrí **`/nueva/?demo`**: datos de ejemplo guardados solo en tu navegador, con un selector para ver la app como administración o como cada colaboradora.

## 🛠️ Cómo está hecha

HTML + CSS + JavaScript puros: sin frameworks, sin dependencias, sin build.

```
casaflow/
├── index.html              # pantalla para elegir app vieja / nueva
├── firestore.rules         # reglas de seguridad (ambas apps)
├── vieja/                  # app vieja, congelada
└── nueva/
    ├── index.html
    ├── css/base.css        # sistema de diseño compartido
    ├── css/nueva.css       # componentes de bloques
    └── js/
        ├── firebase-config.js
        ├── core.js         # fechas, formato y reglas del dominio
        ├── store.js        # datos: nube (Firebase) o demo (navegador)
        └── app.js          # pantallas y acciones
```

## 🤝 Licencia

MIT — usala, adaptala, mejorala.

---

*Hecho con cariño para las casas que funcionan gracias a su gente.* 💜
