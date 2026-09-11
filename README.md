# Gemini Ultimate Extension

Une extension Chrome puissante (et un script Tampermonkey) pour automatiser et améliorer votre expérience sur [Gemini](https://gemini.google.com/).

## 🌟 Fonctionnalités

- **Sélection du Modèle Préféré** : Sélectionne vos modèles préférés (ex: "Flash", "Rapid", "3.5 Flash") s'ils ne sont pas actifs par défaut.
- **Envoi rapide avec Annulation** : Remplit et envoie automatiquement votre prompt via une URL paramétrée, tout en proposant un bandeau d'annulation instantanée (bouton ou touche `Échap`) et une protection anti-doublon lors de réouvertures d'onglets.
- **Interface de Configuration** : Ajustez facilement vos modèles cibles et les délais d'exécution via un popup moderne (Thème sombre Gemini).
- **Mode Sans Compte** : Compatible avec la version publique de Gemini (sans être connecté à un compte Google).
- **Compatible Neural Expressive** : Support total de la nouvelle interface Gemini (Google I/O 2026).

## 💡 Comment ça marche ?

Google Gemini supporte nativement un **paramètre de requête dans l'URL** : `https://gemini.google.com/app?q=%s`

Le `%s` est remplacé par votre texte, ce qui permet de pré-remplir automatiquement le champ de saisie. Cette extension exploite cette fonctionnalité en :

1. **Détectant le paramètre `?q=`** dans l'URL et nettoyant immédiatement l'historique d'URL
2. **Sélectionnant votre modèle préféré** (Flash/Rapid) si un autre modèle est actif
3. **Envoyant automatiquement le prompt** après un compte à rebours visuel (annulable d'un clic ou avec `Échap`)

Cela vous permet d'obtenir des réponses instantanées avec le modèle **fast** de Google, directement depuis votre barre d'adresse !

## 🚀 Installation (Extension Chrome)

C'est la méthode la plus simple et recommandée. Cliquez simplement sur le lien ci-dessous pour l'ajouter à Chrome :

[**Télécharger sur le Chrome Web Store**](https://chromewebstore.google.com/detail/gemini-ultimate/jhpkldiddcobahfolmjiobbacjbgdegl?authuser=0&hl=en-GB)

### Installation Manuelle (Pour les développeurs)

1.  Clonez ce dépôt ou téléchargez les fichiers.
2.  Ouvrez Google Chrome et allez sur `chrome://extensions`.
3.  Activez le **Mode développeur** (en haut à droite).
4.  Cliquez sur **Charger l'extension non empaquetée**.
5.  Sélectionnez le dossier `Extension` situé dans ce projet.

## ⚡ Utilisation Rapide (Barre d'adresse)

Pour utiliser l'extension à son plein potentiel, configurez un moteur de recherche personnalisé dans votre navigateur :

1.  Allez dans les **Paramètres** de votre navigateur > **Moteur de recherche** > **Gérer les moteurs de recherche et la recherche sur le site**.
2.  À côté de "Recherche sur le site", cliquez sur **Ajouter**.
3.  Remplissez les champs comme suit :
    *   **Nom** : `Gemini Search`
    *   **Raccourci** : `:ai` (ou ce que vous préférez)
    *   **URL avec %s à la place de la requête** : `https://gemini.google.com/app?q=%s`

**Utilisation :**
Tapez simplement `:ai` + `Espace` + `Votre question` dans la barre d'adresse. L'extension se chargera de choisir le bon modèle et d'envoyer votre message !
