export const config = {
 apiBase: import.meta.env.VITE_BACKEND_URL,
 appName: 'Lifebookz Author Portal',
 // Accounts are created in the client portal (one account serves every
 // portal), so sign-up links point there.
 readerSignupUrl: import.meta.env.VITE_CLIENT_URL,
};
