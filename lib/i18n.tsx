"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";

export type Locale = "es" | "en";

export function dateLocale(locale: Locale): string {
  return locale === "es" ? "es-CR" : "en-US";
}

const STORAGE_KEY = "payround.locale";

const messages = {
  es: {
    "nav.admin": "Admin",
    "nav.member": "Miembro",
    "nav.dashboard": "Panel",
    "nav.subscriptions": "Suscripciones",
    "nav.notifications": "Notificaciones",
    "nav.friends": "Amigos",
    "nav.stats": "Estadísticas",
    "nav.payments": "Mis pagos",
    "nav.settings": "Ajustes",
    "nav.help": "Ayuda",
    "nav.signOut": "Cerrar sesión",
    "nav.menu": "Menú",
    "nav.openMenu": "Abrir menú",
    "nav.closeMenu": "Cerrar menú",
    "nav.workspace": "Espacio de trabajo",
    "nav.loading": "Cargando",
    "theme.label": "Tema",
    "theme.light": "Claro",
    "theme.dark": "Oscuro",
    "theme.auto": "Auto",
    "settings.title": "Ajustes",
    "settings.lead": "Perfil, idioma, tema y cuenta.",
    "settings.displayName": "Nombre para mostrar",
    "settings.saveName": "Guardar nombre",
    "settings.language": "Idioma",
    "settings.theme": "Tema",
    "settings.themeHint": "Toca el icono sol / luna para cambiar.",
    "settings.options": "Opciones",
    "settings.account": "Cuenta",
    "settings.deleteAccount": "Eliminar cuenta",
    "settings.deleteConfirmTitle": "¿Eliminar tu cuenta?",
    "settings.deleteConfirmBody":
      "Se eliminará tu acceso y tus datos. Los dueños de tus suscripciones recibirán una notificación.",
    "settings.deleteConfirm": "Sí, eliminar",
    "settings.cancel": "Cancelar",
    "settings.deleting": "Eliminando…",
    "settings.nameEmpty": "El nombre no puede estar vacío.",
    "settings.nameSaveError": "No se pudo guardar el nombre. Intenta de nuevo.",
    "settings.deleteError": "No se pudo eliminar la cuenta. Intenta de nuevo.",
    "friends.title": "Amigos",
    "friends.lead": "Personas en tus suscripciones.",
    "friends.empty": "Aún no tienes miembros en tus suscripciones.",
    "friends.hint":
      "Invita amigos al crear una suscripción y aparecerán aquí.",
    "friends.newSub": "Nueva suscripción",
    "friends.copyEmail": "Copiar correo",
    "friends.copied": "¡Copiado!",
    "stats.title": "Estadísticas",
    "stats.owned": "Que administras",
    "stats.joined": "Unidas",
    "stats.pendingReview": "En revisión",
    "stats.paid": "Pagados",
    "stats.missing": "Pendientes",
    "stats.cycleOverview": "Ciclo actual",
    "stats.paymentStatus": "Estado de pagos (tus suscripciones)",
    "stats.subsBreakdown": "Suscripciones",
    "stats.empty": "Aún no hay datos de este ciclo.",
    "stats.loading": "Cargando estadísticas…",
    "help.title": "Ayuda",
    "help.lead": "Guía rápida y preguntas frecuentes.",
    "help.quickTitle": "Empezar",
    "help.tip1": "Como Admin crea suscripciones e invita amigos; como Miembro sube el comprobante de pago.",
    "help.tip2": "Las notificaciones concentran invitaciones, revisiones y cambios de ciclo.",
    "help.tip3": "En Ajustes puedes cambiar nombre, idioma, tema o eliminar tu cuenta.",
    "help.faqTitle": "Preguntas frecuentes",
    "help.faq1q": "¿Qué es Admin y Miembro?",
    "help.faq1a":
      "Admin es quien crea y administra la suscripción. Miembro es quien se une y paga su parte con comprobante.",
    "help.faq2q": "¿Cómo invito a alguien?",
    "help.faq2a":
      "Al crear una suscripción añade correos o envía el enlace de invitación. También puedes añadir miembros desde el detalle de la suscripción.",
    "help.faq3q": "¿Cómo se divide el costo?",
    "help.faq3a":
      "Puedes repartir en partes iguales o asignar montos personalizados a cada persona al crear el plan.",
    "help.faq4q": "¿Qué comprobantes se aceptan?",
    "help.faq4a":
      "JPG, PNG, WebP, HEIC o PDF. El Admin revisa y confirma o rechaza cada pago.",
    "help.faq5q": "¿Qué pasa si cancelo una suscripción?",
    "help.faq5a":
      "Se cancela de forma suave: se notifica a miembros e invitados, y se conserva el historial del mes en curso.",
    "help.faq6q": "¿Puedo eliminar mi cuenta?",
    "help.faq6a":
      "Sí, desde Ajustes. Se elimina tu acceso; los dueños de suscripciones donde participabas recibirán una notificación.",
    "proof.submit": "Enviar proof",
    "proof.upload": "Subir comprobante de pago",
    "proof.uploadHint": "JPG, PNG, WebP, HEIC o PDF",
    "proof.changeFile": "Elegir otro archivo",
    "proof.pdfLabel": "PDF",
    "proof.uploading": "Subiendo…",
    "proof.underReview": "En revisión",
    "proof.submitted": "Comprobante enviado",
    "proof.waitingOwner": "Esperando confirmación del dueño",
    "proof.confirmed": "Pago confirmado",
    "proof.ownerNote": "Nota del dueño",
    "proof.invalidType": "Usa una imagen (JPG, PNG, WebP, HEIC) o un PDF.",
    "pay.title": "Mis pagos",
    "pay.greeting": "Hola",
    "pay.empty": "Aún no te han agregado a ninguna suscripción.",
    "pay.emptyHint": "Cuando aceptes una invitación, aparecerá aquí.",
    "pay.invites": "Tienes {n} invitación(es) pendiente(s)",
    "pay.viewInvites": "Ver notificaciones",
    "pay.dueDay": "Vence el día {day}",
    "pay.youOwe": "Debes",
    "pay.status.paid": "Pagado",
    "pay.status.underReview": "En revisión",
    "pay.status.due": "Pago pendiente",
    "pay.view": "Cards",
    "pay.list": "Lista",
    "pay.openDetails": "Ver detalles",
    "pay.closeDetails": "Ocultar",
    "pay.roster": "Miembros",
    "pay.roster.you": "Tú",
    "pay.roster.paid": "Pagado",
    "pay.roster.underReview": "En revisión",
    "pay.roster.paymentDue": "Pago pendiente",
    "pay.loadError": "No se pudieron cargar tus suscripciones.",
    "dash.lead": "Tus suscripciones activas",
    "dash.viewAria": "Vista del panel",
    "dash.cards": "Tarjetas",
    "dash.list": "Lista",
    "dash.newSub": "Nueva suscripción",
    "dash.pendingBanner": "{n} pago(s) esperando tu revisión.",
    "dash.missingBanner": "{n} aún sin pagar este mes.",
    "dash.statActive": "Suscripciones activas",
    "dash.statPending": "En revisión",
    "dash.statMissing": "Pagos faltantes",
    "dash.selectAll": "Seleccionar todo",
    "dash.cancelSelected": "Cancelar seleccionadas ({n})",
    "dash.emptyTitle": "Aún no hay suscripciones",
    "dash.emptyHint": "Crea tu primera suscripción para empezar a llevar los pagos.",
    "dash.emptyCta": "Crear una",
    "dash.member": "miembro",
    "dash.members": "miembros",
    "dash.dueMeta": "Vence el {day} · ${amount}/persona · {n} {members}",
    "dash.dueDay": "Vence el {day}",
    "dash.perPerson": "${amount} / persona",
    "dash.created": "Creada {date}",
    "dash.status.noMembers": "Sin miembros",
    "dash.status.allPaid": "Todo pagado",
    "dash.status.toReview": "{n} por revisar",
    "dash.status.missing": "{n} faltante(s)",
    "dash.status.review": "revisión",
    "dash.status.missingLabel": "faltante",
    "dash.status.confirmed": "confirmado",
    "dash.readyClose": "Listo para cerrar",
    "dash.open": "abierto",
    "dash.bulkTitle": "¿Cancelar {n} suscripción(es)?",
    "dash.bulkBody":
      "Se cancela de forma suave. Se notificará a miembros e invitados. Se conserva el historial del mes en curso.",
    "dash.bulkKeep": "Mantener",
    "dash.bulkConfirm": "Confirmar cancelación",
    "dash.bulkCancelling": "Cancelando…",
    "notif.title": "Notificaciones",
    "notif.lead": "Invitaciones, actualizaciones de pago y cambios de ciclo.",
    "notif.markAll": "Marcar todas como leídas",
    "notif.marking": "Marcando…",
    "notif.empty": "Aún no hay notificaciones.",
    "notif.today": "Hoy",
    "notif.earlier": "Anteriores",
    "notif.ago.just": "Ahora",
    "notif.ago.m": "hace {n} min",
    "notif.ago.h": "hace {n} h",
    "notif.ago.d": "hace {n} d",
    "notif.copy.proofUploaded": "{name} subió un comprobante de {sub}",
    "notif.copy.cycle": "Ciclo {cycle}",
    "notif.copy.confirmed": "Tu pago de {sub} fue confirmado",
    "notif.copy.rejected": "Tu pago de {sub} fue rechazado",
    "notif.copy.deadline": "Pronto vence el pago de {sub}",
    "notif.copy.cycleClosed": "{sub} — {cycle} cerrado correctamente",
    "notif.copy.invite": "{name} te invitó a {sub}",
    "notif.copy.inviteDesc":
      "Acepta para unirte. Hasta entonces no aparecerá en Miembro.",
    "notif.copy.cancelled": "{sub} fue cancelada",
    "notif.copy.cancelledDesc":
      "{name} canceló esta suscripción. Ya no aparece en Miembro.",
    "notif.copy.memberLeft": "{name} dejó {sub}",
    "notif.copy.memberLeftDesc": "Eliminó su cuenta de Payround.",
    "notif.copy.generic": "Actualización",
    "newSub.title": "Nueva suscripción",
    "newSub.lead": "Define el plan, agrega amigos y abre el primer ciclo de pago.",
    "newSub.backDashboard": "Volver al panel",
    "newSub.dashboard": "Panel",
    "newSub.back": "Atrás",
    "newSub.step.details": "Detalles",
    "newSub.step.friends": "Amigos",
    "newSub.step.review": "Revisión",
    "newSub.step.share": "Compartir",
    "newSub.serviceName": "Nombre del servicio",
    "newSub.servicePlaceholder": "Netflix, Spotify, Disney+…",
    "newSub.totalCost": "Costo mensual total (USD)",
    "newSub.billingDate": "Fecha de cobro (día del mes)",
    "newSub.billingHint": "¿Qué día del mes vence la factura? (solo 1–{max}.)",
    "newSub.continue": "Continuar",
    "newSub.friendsLead":
      "Agrega correos de quienes dividen la cuenta. Todos reciben una invitación para aceptar antes de aparecer en la suscripción.",
    "newSub.splitMode": "Modo de división",
    "newSub.equalSplit": "Partes iguales",
    "newSub.customAmounts": "Montos personalizados",
    "newSub.yourShare": "Tu parte (dueño)",
    "newSub.friendEmailPlaceholder": "amigo@email.com",
    "newSub.removeRow": "Quitar fila",
    "newSub.addFriend": "Agregar otro amigo",
    "newSub.eachOwes":
      "Cada persona debe ${amount}/mes · {n} amigo(s) + tú",
    "newSub.customSumOk": "Las partes suman ${amount}",
    "newSub.customSumBad": "Las partes deben sumar ${amount} (dueño + amigos)",
    "newSub.continueReview": "Continuar a revisión",
    "newSub.summary": "Resumen",
    "newSub.label.service": "Servicio",
    "newSub.label.totalCost": "Costo total",
    "newSub.label.billingDay": "Día de cobro",
    "newSub.label.split": "División",
    "newSub.label.friends": "Amigos",
    "newSub.label.yourShare": "Tu parte",
    "newSub.label.eachPays": "Cada uno paga",
    "newSub.label.firstCycle": "Primer ciclo",
    "newSub.perMonth": "${amount} / mes",
    "newSub.friendsInvited": "{n} invitados",
    "newSub.billingDayPhrase": "el día {day} de cada mes",
    "newSub.bullet.cycle": "✓ Se abre un nuevo ciclo de pago para el mes actual.",
    "newSub.bullet.registered":
      "✓ Los amigos registrados reciben una notificación en la app.",
    "newSub.bullet.manage":
      "✓ Puedes administrar esta suscripción desde el panel.",
    "newSub.inviteCount":
      "{n} amigo(s) recibirán un correo de invitación (incluidos quienes ya están en Payround).",
    "newSub.creating": "Creando…",
    "newSub.launch": "Lanzar tracker",
    "newSub.shareTitle": "Compartir invitaciones",
    "newSub.shareLead":
      "Tu suscripción ya está activa. Quienes tienen cuenta reciben invitación en la app; todos también pueden usar el enlace (WhatsApp o copiar).",
    "newSub.inAppSent":
      "Notificación enviada — deben Aceptar en Notificaciones antes de unirse.",
    "newSub.whatsappMsg":
      "Te invitaron a dividir {name} en Payround: {url}",
    "newSub.shareWhatsApp": "Compartir por WhatsApp",
    "newSub.continueDashboard": "Ir al panel",
    "newSub.lookup.registered":
      "Registrado — aceptarán desde Notificaciones",
    "newSub.lookup.notRegistered":
      "Aún no registrado — recibirán un enlace de invitación",
    "newSub.lookup.couldNot":
      "No se pudo buscar este correo — recibirán un enlace de invitación",
    "newSub.lookup.notRegisteredInvite":
      "Aún no registrado — recibirán un correo de invitación para unirse a Payround",
    "newSub.sessionError":
      "No se pudo verificar tu sesión para enviar invitaciones. Intenta de nuevo tras iniciar sesión.",
    "newSub.emailFail.inApp":
      "Invitación en la app enviada; el correo no se entregó.",
    "newSub.emailFail.generic": "El correo no se entregó.",
    "newSub.genericError": "Algo salió mal. Intenta de nuevo.",
    "dayPicker.preview": "día {day} de cada mes",
    "dayPicker.pick": "Elige un día en el calendario",
    "dayPicker.hint":
      "Solo usamos el día del mes (máximo {max} para que febrero sea seguro). El año/mes del calendario se ignoran.",
    "copy.link": "Copiar enlace",
    "copy.copied": "¡Copiado!",
    "icon.title": "Icono del servicio",
    "icon.change": "Cambiar icono",
    "icon.close": "Cerrar",
    "icon.auto": "Automático",
    "icon.default": "Por defecto",
    "icon.search": "Buscar marca…",
    "icon.noResults": "Sin resultados",
    "icon.autoHint": "Detectado: {detected}",
    "icon.usingDefault": "Usando icono por defecto",
    "icon.usingCustom": "Icono: {slug}",
    "icon.clickToChange": "Toca el icono para cambiarlo",
    "icon.pickHint": "Elige una marca o usa automático",
  },
  en: {
    "nav.admin": "Admin",
    "nav.member": "Member",
    "nav.dashboard": "Dashboard",
    "nav.subscriptions": "Subscriptions",
    "nav.notifications": "Notifications",
    "nav.friends": "Friends",
    "nav.stats": "Stats",
    "nav.payments": "My payments",
    "nav.settings": "Settings",
    "nav.help": "Help",
    "nav.signOut": "Sign out",
    "nav.menu": "Menu",
    "nav.openMenu": "Open navigation menu",
    "nav.closeMenu": "Close menu",
    "nav.workspace": "Workspace",
    "nav.loading": "Loading",
    "theme.label": "Theme",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.auto": "Auto",
    "settings.title": "Settings",
    "settings.lead": "Profile, language, theme, and account.",
    "settings.displayName": "Display name",
    "settings.saveName": "Save name",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.themeHint": "Tap the sun / moon icon to switch.",
    "settings.options": "Options",
    "settings.account": "Account",
    "settings.deleteAccount": "Delete account",
    "settings.deleteConfirmTitle": "Delete your account?",
    "settings.deleteConfirmBody":
      "Your access and profile data will be removed. Subscription owners you joined will be notified.",
    "settings.deleteConfirm": "Yes, delete",
    "settings.cancel": "Cancel",
    "settings.deleting": "Deleting…",
    "settings.nameEmpty": "Name cannot be empty.",
    "settings.nameSaveError": "Could not save name. Try again.",
    "settings.deleteError": "Could not delete account. Try again.",
    "friends.title": "Friends",
    "friends.lead": "People across your subscriptions.",
    "friends.empty": "No members in your subscriptions yet.",
    "friends.hint":
      "Invite friends when creating a subscription and they will show up here.",
    "friends.newSub": "New subscription",
    "friends.copyEmail": "Copy email",
    "friends.copied": "Copied!",
    "stats.title": "Stats",
    "stats.owned": "You manage",
    "stats.joined": "Joined",
    "stats.pendingReview": "Under review",
    "stats.paid": "Paid",
    "stats.missing": "Missing",
    "stats.cycleOverview": "Current cycle",
    "stats.paymentStatus": "Payment status (your subscriptions)",
    "stats.subsBreakdown": "Subscriptions",
    "stats.empty": "No data for this cycle yet.",
    "stats.loading": "Loading stats…",
    "help.title": "Help",
    "help.lead": "Quick guide and frequently asked questions.",
    "help.quickTitle": "Getting started",
    "help.tip1": "As Admin create subscriptions and invite friends; as Member upload payment proof.",
    "help.tip2": "Notifications collect invites, reviews, and cycle updates.",
    "help.tip3": "In Settings you can change name, language, theme, or delete your account.",
    "help.faqTitle": "FAQ",
    "help.faq1q": "What are Admin and Member?",
    "help.faq1a":
      "Admin creates and manages the subscription. Member joins and pays their share with proof.",
    "help.faq2q": "How do I invite someone?",
    "help.faq2a":
      "When creating a subscription add emails or share the invite link. You can also add members from the subscription detail.",
    "help.faq3q": "How is the cost split?",
    "help.faq3a":
      "You can split equally or assign custom amounts to each person when creating the plan.",
    "help.faq4q": "What proof files are accepted?",
    "help.faq4a":
      "JPG, PNG, WebP, HEIC, or PDF. The Admin reviews and confirms or rejects each payment.",
    "help.faq5q": "What happens if I cancel a subscription?",
    "help.faq5a":
      "It soft-cancels: members and invitees are notified, and the current month history is kept.",
    "help.faq6q": "Can I delete my account?",
    "help.faq6a":
      "Yes, from Settings. Your access is removed; owners of subscriptions you joined will be notified.",
    "proof.submit": "Submit proof",
    "proof.upload": "Upload payment proof",
    "proof.uploadHint": "JPG, PNG, WebP, HEIC, or PDF",
    "proof.changeFile": "Choose another file",
    "proof.pdfLabel": "PDF",
    "proof.uploading": "Uploading…",
    "proof.underReview": "Under review",
    "proof.submitted": "Proof submitted",
    "proof.waitingOwner": "Waiting for the owner to confirm",
    "proof.confirmed": "Payment confirmed",
    "proof.ownerNote": "Note from owner",
    "proof.invalidType": "Use an image (JPG, PNG, WebP, HEIC) or a PDF.",
    "pay.title": "My payments",
    "pay.greeting": "Hi",
    "pay.empty": "You haven't been added to any subscriptions yet.",
    "pay.emptyHint": "When you accept an invite, it will show up here.",
    "pay.invites": "You have {n} pending invite(s)",
    "pay.viewInvites": "View notifications",
    "pay.dueDay": "Due day {day}",
    "pay.youOwe": "You owe",
    "pay.status.paid": "Paid",
    "pay.status.underReview": "Under review",
    "pay.status.due": "Payment due",
    "pay.view": "Cards",
    "pay.list": "List",
    "pay.openDetails": "View details",
    "pay.closeDetails": "Hide",
    "pay.roster": "Members",
    "pay.roster.you": "You",
    "pay.roster.paid": "Paid",
    "pay.roster.underReview": "Under review",
    "pay.roster.paymentDue": "Payment due",
    "pay.loadError": "Could not load your subscriptions.",
    "dash.lead": "Your active subscriptions",
    "dash.viewAria": "Dashboard view",
    "dash.cards": "Cards",
    "dash.list": "List",
    "dash.newSub": "New subscription",
    "dash.pendingBanner": "{n} payment(s) waiting for your review.",
    "dash.missingBanner": "{n} still missing this month.",
    "dash.statActive": "Active subscriptions",
    "dash.statPending": "Pending review",
    "dash.statMissing": "Missing payments",
    "dash.selectAll": "Select all",
    "dash.cancelSelected": "Cancel selected ({n})",
    "dash.emptyTitle": "No subscriptions yet",
    "dash.emptyHint": "Create your first subscription to start tracking payments.",
    "dash.emptyCta": "Create one",
    "dash.member": "member",
    "dash.members": "members",
    "dash.dueMeta": "Due {day}th · ${amount}/person · {n} {members}",
    "dash.dueDay": "Due {day}th",
    "dash.perPerson": "${amount} / person",
    "dash.created": "Created {date}",
    "dash.status.noMembers": "No members",
    "dash.status.allPaid": "All paid",
    "dash.status.toReview": "{n} to review",
    "dash.status.missing": "{n} missing",
    "dash.status.review": "review",
    "dash.status.missingLabel": "missing",
    "dash.status.confirmed": "confirmed",
    "dash.readyClose": "Ready to close",
    "dash.open": "open",
    "dash.bulkTitle": "Cancel {n} subscription(s)?",
    "dash.bulkBody":
      "This soft-cancels the selected subscriptions. Members and pending invitees will be notified. History for the current month is kept.",
    "dash.bulkKeep": "Keep",
    "dash.bulkConfirm": "Confirm cancel",
    "dash.bulkCancelling": "Cancelling…",
    "notif.title": "Notifications",
    "notif.lead": "Invites to join, payment updates, and cycle changes.",
    "notif.markAll": "Mark all as read",
    "notif.marking": "Marking…",
    "notif.empty": "No notifications yet.",
    "notif.today": "Today",
    "notif.earlier": "Earlier",
    "notif.ago.just": "Just now",
    "notif.ago.m": "{n}m ago",
    "notif.ago.h": "{n}h ago",
    "notif.ago.d": "{n}d ago",
    "notif.copy.proofUploaded": "{name} uploaded proof for {sub}",
    "notif.copy.cycle": "Cycle {cycle}",
    "notif.copy.confirmed": "Your payment for {sub} was confirmed",
    "notif.copy.rejected": "Your payment for {sub} was rejected",
    "notif.copy.deadline": "Payment due soon for {sub}",
    "notif.copy.cycleClosed": "{sub} — {cycle} closed successfully",
    "notif.copy.invite": "{name} invited you to {sub}",
    "notif.copy.inviteDesc":
      "Accept to join this subscription. Until then it won’t appear in Member.",
    "notif.copy.cancelled": "{sub} was cancelled",
    "notif.copy.cancelledDesc":
      "{name} cancelled this subscription. It no longer appears in Member.",
    "notif.copy.memberLeft": "{name} left {sub}",
    "notif.copy.memberLeftDesc": "They removed their account from Payround.",
    "notif.copy.generic": "Update",
    "newSub.title": "New subscription",
    "newSub.lead": "Set the plan, add friends, then open the first payment cycle.",
    "newSub.backDashboard": "Back to dashboard",
    "newSub.dashboard": "Dashboard",
    "newSub.back": "Back",
    "newSub.step.details": "Details",
    "newSub.step.friends": "Friends",
    "newSub.step.review": "Review",
    "newSub.step.share": "Share links",
    "newSub.serviceName": "Service name",
    "newSub.servicePlaceholder": "Netflix, Spotify, Disney+…",
    "newSub.totalCost": "Total monthly cost (USD)",
    "newSub.billingDate": "Billing date (day of the month)",
    "newSub.billingHint": "Which calendar day is the bill due each month? (1–{max} only.)",
    "newSub.continue": "Continue",
    "newSub.friendsLead":
      "Add emails for people who split the bill. Everyone gets an invite to accept before they appear on the subscription.",
    "newSub.splitMode": "Split mode",
    "newSub.equalSplit": "Equal split",
    "newSub.customAmounts": "Custom amounts",
    "newSub.yourShare": "Your share (owner)",
    "newSub.friendEmailPlaceholder": "friend@email.com",
    "newSub.removeRow": "Remove row",
    "newSub.addFriend": "Add another friend",
    "newSub.eachOwes":
      "Each person owes ${amount}/month · {n} friend(s) + you",
    "newSub.customSumOk": "Custom shares sum to ${amount}",
    "newSub.customSumBad": "Shares must sum to ${amount} (owner + friends)",
    "newSub.continueReview": "Continue to review",
    "newSub.summary": "Summary",
    "newSub.label.service": "Service",
    "newSub.label.totalCost": "Total cost",
    "newSub.label.billingDay": "Billing day",
    "newSub.label.split": "Split",
    "newSub.label.friends": "Friends",
    "newSub.label.yourShare": "Your share",
    "newSub.label.eachPays": "Each pays",
    "newSub.label.firstCycle": "First cycle",
    "newSub.perMonth": "${amount} / month",
    "newSub.friendsInvited": "{n} invited",
    "newSub.billingDayPhrase": "the {day} of each month",
    "newSub.bullet.cycle": "✓ A new payment cycle opens for the current month.",
    "newSub.bullet.registered":
      "✓ Registered friends receive an in-app notification.",
    "newSub.bullet.manage":
      "✓ You can manage this subscription from the dashboard.",
    "newSub.inviteCount":
      "{n} friend(s) will receive an invite email (including anyone already on Payround).",
    "newSub.creating": "Creating…",
    "newSub.launch": "Launch tracker",
    "newSub.shareTitle": "Share invites",
    "newSub.shareLead":
      "Your subscription is live. Friends with an account get an in-app invite; everyone can also use the link below (WhatsApp or copy).",
    "newSub.inAppSent":
      "In-app notification sent — they must Accept in Notifications before joining.",
    "newSub.whatsappMsg":
      "You're invited to split {name} on Payround: {url}",
    "newSub.shareWhatsApp": "Share on WhatsApp",
    "newSub.continueDashboard": "Continue to dashboard",
    "newSub.lookup.registered":
      "Registered — they'll accept from Notifications",
    "newSub.lookup.notRegistered":
      "Not registered yet — they'll get an invite link",
    "newSub.lookup.couldNot":
      "Could not look up this email — they'll get an invite link",
    "newSub.lookup.notRegisteredInvite":
      "Not registered yet — they'll get an invite email to join Payround",
    "newSub.sessionError":
      "Could not verify your session to email invites. Try again after re-login.",
    "newSub.emailFail.inApp":
      "In-app invite sent; email was not delivered.",
    "newSub.emailFail.generic": "Email was not delivered.",
    "newSub.genericError": "Something went wrong. Try again.",
    "dayPicker.preview": "{day} of each month",
    "dayPicker.pick": "Pick a day on the calendar",
    "dayPicker.hint":
      "We only use the day of the month (capped at {max} so February stays safe). The year/month on the calendar are ignored.",
    "copy.link": "Copy link",
    "copy.copied": "Copied!",
    "icon.title": "Service icon",
    "icon.change": "Change icon",
    "icon.close": "Close",
    "icon.auto": "Automatic",
    "icon.default": "Default",
    "icon.search": "Search brand…",
    "icon.noResults": "No results",
    "icon.autoHint": "Detected: {detected}",
    "icon.usingDefault": "Using default icon",
    "icon.usingCustom": "Icon: {slug}",
    "icon.clickToChange": "Tap the icon to change it",
    "icon.pickHint": "Pick a brand or use automatic",
  },
} as const;

export type MessageKey = keyof typeof messages.es;

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "es" ? v : null;
  } catch {
    return null;
  }
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    const stored = readStoredLocale();
    if (stored) {
      setLocaleState(stored);
      return;
    }
    if (appUser?.locale === "en" || appUser?.locale === "es") {
      setLocaleState(appUser.locale);
    }
  }, [appUser?.locale, appUser?.uid]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      if (appUser) {
        void updateDoc(doc(db, "users", appUser.uid), { locale: next }).catch(
          () => {
            /* optional sync */
          },
        );
      }
    },
    [appUser],
  );

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      let text: string =
        messages[locale][key] ?? messages.es[key] ?? String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return ctx;
}
