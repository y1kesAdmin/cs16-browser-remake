# Counter-Strike Classic — Browser Remake

An original browser-playable first-person arena prototype inspired by classic Counter-Strike. It uses Three.js and procedural geometry; it does not include Valve proprietary code, maps, models, sounds, or textures.

## Run locally

The game uses JavaScript modules, so serve the folder over HTTP instead of double-clicking `index.html`.

### Option 1: Python
1. Extract the ZIP.
2. Open a terminal in the extracted `cs16-browser-remake` folder.
3. Run:

   ```bash
   python -m http.server 8000
   ```
4. Open `http://localhost:8000` in a modern browser.

### Option 2: Visual Studio Code
1. Open the extracted folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.

Three.js is loaded from jsDelivr, with an unpkg fallback, so an internet connection is required. If both CDNs are blocked, the page now shows a startup error instead of silently doing nothing.

## Controls
- WASD: move
- Mouse: look
- Left click: shoot
- R: reload
- 1–4: switch weapon
- Shift: move faster
- Esc: pause / release mouse

## Current features
- First-person camera and pointer-lock mouse look
- Compact original dusty arena with collision
- Four distinct, original procedural weapon silhouettes: AK-style rifle, M4-style rifle, scoped bolt-action rifle, and compact pistol
- Procedural gloved hands, fingers, forearms, and sleeve cuffs
- Weapon idle sway, movement bob, firing recoil, switch dip, and reload movement
- Animated magazine movement; bolt movement on the scoped rifle
- Ammo, reserve ammo, health, armor, and money HUD
- Basic enemy bots, hit marker, kills, and reward money
- Visible startup error overlay for CDN, module, or WebGL startup failures

## Notes / limitations
- This remains a small single-player prototype, not a full CS 1.6 recreation.
- The arms and weapons are made from primitive geometry. They are more detailed than the original blockout, but are not production-quality sculpted assets.
- Reload motions are procedural approximations; the hands do not yet perform a fully articulated magazine removal and insertion animation.
- There is no multiplayer, sound, buy menu, bomb objective, or round economy yet.

## Publish on GitHub Pages
Upload `index.html`, `style.css`, `src/main.js`, and this README so that `index.html` is at the repository root. In **Settings → Pages**, deploy from the `main` branch and `/ (root)` folder.
