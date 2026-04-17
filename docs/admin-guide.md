## Admin configuration & crédits utilisateurs

Ce projet repose sur deux mécanismes critiques :

1. **Les paramètres d’administration** (token e-mail) pour valider des actions sensibles (modération, crédit, bannissement).
2. **Le système de paiement/tokenisation** qui convertit de l’argent réel en jetons utilisables par les utilisateurs.

### Variables d’environnement à définir (voir `docs/env.example.txt`)

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Connexion PostgreSQL (Neon). Doit comprendre `sslmode=require`. |
| `ADMIN_TOKEN` | Jeton secret optionnel pour exécuter des scripts admin (`x-admin-token`). |
| `ADMIN_EMAIL` | Email d’un compte admin. Toute session dont `user.email` (ou `username`) correspond devient admin. |
| `SECRET_TOKEN` | Signature interne et fallback pour certains workflows. |
| `PAYSTACK_SECRET_KEY` | Clé privée Paystack utilisée pour initialiser et vérifier les paiements. |

⚠️  Les scripts `npm run dev`, `npm run env:check`, `npm run build` et les migrations lisent automatiquement `.env` grâce à `dotenv/config`. Après chaque modification, redémarre le serveur (`npm run dev`) pour que les variables soient prises en compte.

### Vérifier la configuration

```bash
npm run env:check
```

Ce script :

- résume les variables (masquées) ;
- valide que `DATABASE_URL` pointe bien vers un host Neon ;
- tente un `SELECT 1` ;
- échoue vite si `PAYSTACK_SECRET_KEY`, `ADMIN_*` ou `R2_*` sont manquants.

### Privileges admin et attribution de crédits

- **Par défaut**, un request HTTP est admin si :
  - `x-admin-token` correspond à `ADMIN_TOKEN`, **ou**
  - l’utilisateur connecté a un email similaire à `ADMIN_EMAIL` (et, si la colonne `emailVerified` existe, il doit être vérifié).

- **Nouvel endpoint** : `POST /api/admin/users/:id/credit`  
  Permet d’ajouter un nombre de jetons arbitraire à un utilisateur (token, ledger).

  Exemple de payload :
  ```json
  {
    "tokens": 25,
    "reason": "Promotion admin"
  }
  ```

  L’endpoint :
  - vérifie que la requête émane bien d’un admin ;
  - met à jour `users.tokensBalance` (coalesce sur les valeurs nulles) ;
  - crée une entrée dans `tokenTransactions` pour historiser l’origine ;
  - renvoie la nouvelle balance.

### Système de paiement (Paystack + jetons)

1. **Packages token** : la source de vérité se trouve dans `server/payments.ts` (`TOKEN_PACKAGES`). Ajuste les `amount`, `currency` et `tokens` si tu veux de nouveaux paliers.
2. **Frontend** : `GET /api/tokens/packages` fournit les packages au client.
3. **Checkout Paystack** :
   - `POST /api/tokens/checkout` initialise une transaction Paystack avec metadata `userId`, `packageId`, `tokens`.
   - Le callback `/api/payments/paystack/callback` et le webhook `/api/payments/paystack/webhook` :
     - vérifient la transaction côté Paystack ;
     - stockent l’événement dans `payments` ;
     - créditent `users.tokensBalance` ;
     - écrivent un `tokenTransactions` avec `reason: "purchase"`.
4. **Journal** : `tokenTransactions` garde une trace de chaque delta (achat/admin) avec métadonnées (`sessionId`, `provider`, `grantedBy`).

### Résumé

1. Remplis `.env` avec les clés admin et Paystack (utilise la connection string complète que Neon/Paystack t’affichent).
2. Lancer `npm run env:check` (`dotenv` se charge d’injecter les variables).
3. `npm run dev` démarrera le serveur, `npm run dev:client` démarre uniquement le front.
4. L’admin peut contrôler les utilisateurs via `ADMIN_EMAIL`/`ADMIN_TOKEN` + utiliser `/api/admin/users/:id/credit` pour attribuer des jetons.

Tu peux maintenant valider les comptes, accorder du crédit et suivre les paiements Paystack dans une logique centralisée.
