# Aeon Shifters [7DRL Edition]

Source code for the Aeon Shifters [7DRL Edition], a 7-day Roguelike built for the 2025 7DRL Jam.  Play it here:

https://rwhaling.itch.io/aeon-shifters

## What is it?

Aeon Shifters is a fast-paced hack and slash action Roguelike, drawing on Dynasty Warriors, Diablo, and others.  The player forms alliances with different factions in large-scale battles, and each faction offers a unique special move as a reward.  By choosing your allies, you create a cusomized build - by my count, there are 120 possible builds at end-game.

Controls: WASD movement, QEZC horizontal movement, bump to regular attack, 1/2/3 for special attacks.  Health and stamina regenerate, killing enemies with regular attacks also regenerates stamina.  Special moves all cost 2 stamina.

## Credits
WebGL engine is based on the engine from [Barrow 2](https://github.com/rwhaling/roguelike-three), with significant modifications to the sprite engine to allow for more particle effects.  Barrow 2 itself drew on Ondrej Zara's https://github.com/ondras/rot.js/, as well as chr15m's https://github.com/chr15m/roguelike-browser-boilerplate.

The TypeScript/react architecture is based on etgrieco's immaculate [p5-vite-typescript-template](https://github.com/etgrieco/p5-vite-typescript-template).  Used Vite for the first time on this project, it's been amazing.

Thanks also to Jim Kang, Bradley Dettmer, and Alex McKendry for pairing and feedback during the development process.  

Sprites: Phosphor by Loren Schmidt, https://lorenschmidt.itch.io/phosphor
Music: by me, borrowed from Barrow 2.

## Building for distribution

1. Run `pnpm build`
2. rm -rf dist
3. cp -r bg_edits_1.png fg_characters.png dist
4. zip -rXq aeon_shifters.zip dist


# Credits


* `Inconsolata` font included for demonstration purposes; [Inconsolata font license](https://www.fontsquirrel.com/license/Inconsolata).