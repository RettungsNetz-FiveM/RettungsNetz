// ═══════════════════════════════════════════════════════
// RETTUNGSNETZ · AUTH CONFIG
// Trage hier deinen Bot Token ein (Zeile DISCORD_BOT_TOKEN)
// ═══════════════════════════════════════════════════════

const RN_CONFIG = {
  // Firebase
  firebase: {
    apiKey: "AIzaSyCTYpbBGp_aYG_i9drbtwJ6IhduHEdfb_Q",
    authDomain: "rettungsnetz.firebaseapp.com",
    databaseURL: "https://rettungsnetz-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "rettungsnetz",
    storageBucket: "rettungsnetz.firebasestorage.app",
    messagingSenderId: "697193964828",
    appId: "1:697193964828:web:abdb140c42a389bbdf06d9",
    measurementId: "G-HVP6PJN2CP"
  },

  // Discord OAuth2
  discord: {
    clientId: "947146036093263982",
    clientSecret: "2XBfPLraa9pAANroEnMyyoDSIzRvpJtd",
    // ⚠️ Bot Token hier eintragen nach Reset:
    botToken: "DEIN_BOT_TOKEN_HIER",
    redirectUri: "https://rettungsnetz.github.io/Dashboard/auth-callback.html",
    scopes: ["identify", "guilds", "guilds.members.read"]
  },

  // Entwickler Account (höchste Rechte)
  devUserId: "480087023521366017",

  // App URL
  appUrl: "https://rettungsnetz.github.io/Dashboard"
};

// Rollen-Hierarchie
const RN_ROLES = {
  DEV:    { level: 99, label: "Entwickler",  color: "#e63946" },
  OWNER:  { level: 3,  label: "Inhaber",     color: "#f4a261" },
  ADMIN:  { level: 2,  label: "Admin",       color: "#8b5cf6" },
  MEMBER: { level: 1,  label: "Mitglied",    color: "#52b788" },
  GUEST:  { level: 0,  label: "Gast",        color: "#4a5a70" }
};

if (typeof module !== 'undefined') module.exports = { RN_CONFIG, RN_ROLES };
