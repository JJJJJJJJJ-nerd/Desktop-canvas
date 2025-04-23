# Desktop File Manager Backup

Deze map bevat een backup van de huidige versie van je desktop file manager, inclusief de werkende map viewer implementatie die we hebben gebouwd.

## Backup bestand

Het ZIP bestand bevat alle broncode van het project. Het is ongeveer 15 MB groot en bevat alle code en assets, maar geen node_modules of andere grote bestanden die niet nodig zijn.

## Hoe te gebruiken

1. Download het ZIP bestand via de Replit file browser
2. Pak het uit op je eigen computer
3. Open het project in een code editor
4. Voer `npm install` uit om de dependencies te installeren
5. Start het project met `npm run dev`

## Belangrijke bestanden in deze versie

- `client/src/pages/FolderContentPage.tsx` - Standalone pagina voor het weergeven van mapinhoud
- `client/src/components/DraggableFolderWindow.tsx` - Het versleepbare venster component
- `client/src/components/FolderIframe.tsx` - Het iframe component dat de standalone pagina laadt
- `client/src/pages/Desktop.tsx` - De desktop pagina met de map venster implementatie

## Een nieuwe backup maken

Als je meer wijzigingen maakt en nog een backup wilt maken, voer dan uit:

```
cd backup
./make_backup.sh
```

Dit zal een nieuw ZIP bestand aanmaken met de huidige staat van het project.