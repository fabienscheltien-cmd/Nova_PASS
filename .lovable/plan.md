# Header Nova Pass — mise à jour visuelle

## Objectif
Moderniser le header de la page d’accueil `/` avec un bleu pastel commun à « PASS » et au sous-titre « Accueil visiteurs », centrer le bloc identité, et intégrer le nouveau logo NOVA uploadé tout en conservant le logo Nova Serenity existant.

## Modifications prévues

### 1. Assets
- Uploader l’image `user-uploads://image-4.png` (logo NOVA bleu avec symbole) comme asset Lovable dans `src/assets/nova-logo.png.asset.json`.
- Conserver l’asset `src/assets/nova-serenity.png.asset.json` déjà présent.

### 2. Design tokens (`src/styles.css`)
- Ajouter un token `--pass-pastel` (bleu pastel) mappé dans `@theme inline` comme `--color-pass-pastel`.
- Utiliser cette teinte pour :
  - le texte « PASS » dans le header ;
  - le sous-titre « Accueil visiteurs » dans la section principale.
- Le token `--pass` corail/orange actuel reste inchangé pour les boutons et accents existants.

### 3. Page d’accueil (`src/routes/index.tsx`)
- **Header :**
  - À gauche : conserver le logo Nova Serenity existant (taille actuelle `w-20 sm:w-24`).
  - Au centre : créer un bloc centré horizontalement contenant le nouveau logo NOVA suivi du texte « PASS ».
  - Le logo NOVA et le texte PASS auront la même hauteur visuelle et seront alignés verticalement.
  - « PASS » sera en bleu pastel, en gras, en majuscules, avec un léger espacement.
  - À droite : conserver le lien « Espace accueil ».
- **Section principale :**
  - Le texte « Accueil visiteurs » passe en majuscules, en bleu pastel, avec une taille augmentée (`text-sm` ou `text-base` selon l’équilibre visuel), et centré horizontalement.
  - Le titre « Bienvenue chez Nova Serenity » et le paragraphe restent inchangés.
  - Le QR code et le lien formulaire restent inchangés.

### 4. Vérification
- Vérifier l’affichage desktop et mobile via le preview.
- S’assurer que le header reste lisible sur la photo de fond et que le bloc central ne chevauche pas le lien « Espace accueil » sur petit écran.

## Non inclus
- Aucune modification du formulaire `/checkin`, du registre `/registre`, des réglages `/reglages`, ni de la logique métier.
- Aucun changement de la couleur des boutons ou des autres éléments utilisant `--pass`.
