# Counter-Strike Classic — Browser Remake

A small browser-playable first-person arena prototype inspired by the feel of classic Counter-Strike. This is an original implementation with a simple dusty arena, procedural placeholder weapons, and basic bots. It does not include Valve's proprietary game code, maps, models, sounds, or textures.

## Run it

Because this project uses JavaScript modules, open it through a local web server rather than double-clicking `index.html`.

### Easiest option: VS Code
1. Extract the ZIP.
2. Open the `cs16-browser-remake` folder in Visual Studio Code.
3. Install the **Live Server** extension.
4. Right-click `index.html` and choose **Open with Live Server**.

### Python option
From this folder, run:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000

Three.js is loaded from jsDelivr, so an internet connection is needed.

## Controls
- WASD: move
- Mouse: look
- Left click: shoot
- R: reload
- 1–4: switch weapon
- Shift: move faster
- Esc: pause / release mouse

## Current prototype features
- First-person camera and pointer-lock mouse look
- Compact original dusty arena with collision
- Procedural AK-47, M4A1, AWP, and Glock-style placeholder weapon shapes
- Ammo, reserve ammo, health, armor, and money HUD
- Basic enemy bots that approach and attack
- Hit marker, kills, and simple reward money

## Planned improvements
- Better weapon and hand models / animations
- Authentic movement tuning, recoil patterns, and sound
- More detailed original maps
- Round system, buy menu, bomb objective, and multiplayer

## GitHub
Create a new repository, extract this project, then upload the files or use:

```bash
git init
git add .
git commit -m "Initial CS classic browser remake"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```
