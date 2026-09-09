# Registre de visiteurs par QR code

Outil d'accueil : un visiteur scanne un QR code affiché à l'accueil, remplit sa fiche, et la visite s'enregistre dans un registre consultable par l'hôtesse.

## Ce que verra l'utilisateur

**1. Page d'accueil (écran ou affiche)**
- Un grand QR code à afficher/imprimer, qui pointe vers le formulaire visiteur.
- Bouton pour imprimer l'affichette.

**2. Formulaire visiteur (ouvert par le scan, pensé pour mobile)**
- Nom, prénom, entreprise du visiteur
- Personne visitée, entreprise visitée
- Date et heure remplies automatiquement (modifiables)
- Validation : champs obligatoires, longueurs limitées
- Après envoi : écran de confirmation « Merci, l'accueil a été prévenu »

**3. Registre (réservé à l'accueil, avec connexion)**
- Page de connexion par e-mail / mot de passe
- Tableau des visites, les plus récentes en haut
- Filtres en ligne : période (date de début / date de fin), plus recherche par nom, entreprise ou personne visitée
- Export Excel des résultats affichés (respecte les filtres)

**4. Notification à l'accueil**
- Un e-mail récapitulatif est envoyé à l'adresse de l'accueil à chaque nouvelle arrivée.
- Vous n'avez pas encore de domaine : l'envoi ne pourra pas fonctionner tant qu'un domaine que vous possédez n'est pas ajouté. En attendant, chaque nouvelle visite apparaît immédiatement dans le registre (rafraîchissement automatique) pour que l'hôtesse soit prévenue.
- L'adresse e-mail de l'accueil sera configurable dans une page « Réglages ».

## Détails techniques

- Activation de Lovable Cloud (base de données + comptes + envoi d'e-mails).
- Table `visits` : nom, prénom, entreprise, personne visitée, entreprise visitée, horodatage d'arrivée, date de création.
- Écriture publique contrôlée : l'enregistrement passe par une fonction serveur validée (Zod), pas d'accès direct en base depuis le formulaire. Lecture réservée aux comptes authentifiés (RLS + grants).
- Table `settings` (adresse e-mail de l'accueil), lecture/écriture authentifiées uniquement.
- Export Excel via SheetJS côté navigateur, à partir des lignes filtrées.
- Envoi e-mail via l'infrastructure e-mail intégrée, appelée après enregistrement ; l'échec d'envoi ne bloque jamais l'enregistrement de la visite.
- Routes : `/` (QR code à afficher), `/checkin` (formulaire visiteur), `/auth` (connexion), `/registre` (registre protégé), `/reglages`.

## Hors périmètre

- Pas d'heure de sortie ni de calcul de durée.
- Pas de champs téléphone, e-mail visiteur, motif ou plaque.
