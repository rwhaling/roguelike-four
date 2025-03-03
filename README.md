# React + Richard's WebGL Engine Starter template

Based on etgrieco's immaculate [p5-vite-typescript-template](https://github.com/etgrieco/p5-vite-typescript-template)

Features::
- [vite](https://vite.dev/) as a development server + build tooling
    - HMR for automatic refreshing of changes on save
- TypeScript 
- TailwindCSS if you would like to use that to style your HTML elements outside of your p5.js canvas.
- WebGL sprite engine extracted from [Barrow 2](https://github.com/rwhaling/roguelike-three)

- TODO: supply non-license encumbered assets - Barrow 2 used a set by Oryx Design Lab that I cannot redistribute, but there are plent of other great ones available.

## Using the template

1. Copy the template to your github.
1. Run `pnpm install`
1. Start coding in `main.tsx`!

## Building for distribution

1. Run `pnpm build`
2. rm -rf dist
3. cp -r bg_edits_1.png fg_characters.png dist
4. zip -rXq aeon_shifters.zip dist

### Changing package managers

Remove `pnpm-lock.yaml`, change/remove the `"packageManager"` field from `package.json`, and replace with a package manager of your choice (npm, yarn, bun, etc.)

### Removing Tailwind

If you have no use for Tailwind, update `vite.config.ts`.

```diff
import { defineConfig } from "vite";
- import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
-  plugins: [tailwindcss()],
});
```

and `styles.css`

```diff
- @import "tailwindcss";

+ .my-styles {
+    /* My CSS goes here <3 */
+ }
```

## Steps to set this up yourself

If this project becomes out of date, here are the fundamentals behind what is happening:

1. `pnpm create vite` (feel free to use any package manager of your choice)
1. Create a `Vanilla` project
1. (optional) Create a `vite.config.ts` file with preferences to build p5 as a separate chunk
    - Note: we do this the help preserve bandwidth for your users. We assume your application code is going to change more frequently than your P5 version. This helps to avoid users from having to re-download P5.js over and over again.
    ```ts
    import { defineConfig } from "vite";
    import tailwindcss from "@tailwindcss/vite";

    export default defineConfig({
          build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        p5: ["p5"],
                    },
                },
            },
        },
    });
    ```
1. (optional) Add TailwindCSS
    - Create a `vite.config.ts` file; add the vite TailwindCSS plugin to your project
    - Add a `styles.css` file to your project.
        ```css
        @import "tailwindcss";
        ```
    - Ensure you're adding `styles.css` to your `index.html` or `main.ts` file
        ```html
        <link href="/src/styles.css" rel="stylesheet">
        ```
        or

        ```ts
        import "./styles.css"
        ```
1. Delete the entirety of the `main.ts` counter boilerplate
1. Create any mounting node(s) necessary within your `index.html`; this is what p5 will mount its canvas to.
1. Create a p5 factory function that allows to start p5 in instance mode. All p5 "globals" will be instead attached to this instance, allowing you to utilize and browse all the utility features of p5 without polluting the global scope.
    ```ts
    function myP5(p: p5) {
    // user code goes here
    Object.assign(p, {
        preload() {
            // ...
        },
        setup() {
            // ...
        },
        draw() {
            // ...
        },
        } satisfies Pick<typeof p, "preload" | "setup" | "draw">);
    }
    ```
1. Get started building your p5.js work!

# Credits

# 
* `Inconsolata` font included for demonstration purposes; [Inconsolata font license](https://www.fontsquirrel.com/license/Inconsolata).